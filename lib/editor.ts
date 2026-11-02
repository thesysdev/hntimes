import OpenAI from "openai";
import { getComment, plainText, type Thread } from "./thread";
import { selectComments } from "./thread-prompt";

// The assignment editor: a quick model pass over the thread before the edition is written. It
// decides what the story is (the angle and the kind of story), who the people worth quoting are,
// and what the lead art should show. The writer gets these as notes. It runs alongside the
// article fetch, so the edition only waits on it when it takes longer than the article.
//
// Lead art (off for now) is then chosen in two ways, resolved by the edition route:
// 1. the article's own preview image, if it's a real one (isGenericImage weeds out logos and cards);
// 2. otherwise an image search with the editor's queries.

/** The kinds of story an edition can be. Each has its own layout in the writer's prompt. */
export const SHAPES = ["debate", "review", "advice", "postmortem", "launch", "explainer"] as const;
export type Shape = (typeof SHAPES)[number];

export type SearchPlan =
  | { use: "search"; kind: "screenshot" | "photo" | "diagram"; queries: string[] }
  | { use: "none"; reason: string };

export type EditorNotes = {
  shape: Shape;
  /** The news in one sentence: what happened and why it matters. */
  angle: string;
  /** A working headline the writer may improve. */
  headline: string;
  /** The irony or human detail that makes the thread worth reading. */
  hook: string;
  /** People worth quoting, by a comment of theirs, with who they say they are. */
  cast: { id: number; author: string; who: string }[];
  /** The moments the story should be built around (up to 3). */
  moments: { id: number; why: string }[];
  image: SearchPlan;
};

/** Site-wide images that say nothing about the story: logos, default share cards, favicons. */
const GENERIC_IMAGE = /(og[-_]?image|default|logo|favicon|placeholder|share[-_]?card|social[-_]?card|brand)/i;

export function isGenericImage(src: string): boolean {
  try {
    const { pathname } = new URL(src);
    return GENERIC_IMAGE.test(pathname.split("/").pop() ?? "") || pathname.split("/").length <= 2;
  } catch {
    return true;
  }
}

const EDITOR_MODEL = process.env.HACKERPAPER_EDITOR_MODEL ?? "openai/gpt-6.1-terra";

/** Comments are cut to this many characters for the editor: enough to tell who's who and what's said. */
const COMMENT_CHARS = 400;
/** The editor reads at most this much of the thread. Its time goes on writing the brief, not reading. */
const THREAD_CHARS = 60_000;

// Images are off for now, so the brief doesn't ask for image queries (they cost output time). To bring
// them back, add to the JSON: "image": {"kind": "screenshot" | "photo" | "diagram" | "none", "queries": [up to 2 strings]}
// and the rule: Image: name the concrete thing the story is about (product, project, site, place or
// object). screenshot for software and websites, photo for physical things and places, diagram for
// technical ideas. No faces unless the story is about a well-known public figure. "none" with no
// queries when the subject is abstract (advice, opinions, career questions).
const INSTRUCTIONS = `You are the assignment editor of a newspaper that covers Hacker News threads. Read the thread and brief the reporter.
Reply with JSON only:
{
  "shape": one of ${SHAPES.map((s) => `"${s}"`).join(", ")},
  "angle": "the news in one sentence of at most 25 words: what happened, and what readers are fighting about or learned",
  "headline": "a working headline in a magazine's manner: two to six words, a phrase, image or light pun",
  "hook": "one sentence: the irony, contradiction or human detail that makes this thread worth reading",
  "cast": [{"id": comment id, "who": "at most 8 words: who they are, from what they say about themselves"}],
  "moments": [{"id": comment id, "why": "at most 8 words"}]
}
Shapes: debate (the thread splits into camps), review (Show HN or a product people tried), advice (Ask HN, readers answering), postmortem (an outage, failure or incident), launch (a release or announcement with numbers), explainer (a technical idea people worked through).
Cast: 3 to 6 people the story should be told through, by one of their comments. Prefer people with standing: the poster, people who say they built, work at, or used the thing, and the sharpest critics. "who" uses only what they say about themselves or what they argue ("a critic of the benchmark", "says they maintain a fork").
Moments: the 3 best lines in the thread: the funniest, the sharpest, the most human, or the one that ended an argument. Prefer lines a reader would repeat to a friend.
Only use comment ids that appear in the thread.`;

/** The thread as the editor reads it: the story, then each comment cut short. */
function briefing(thread: Thread): string {
  const { story } = thread;
  const lines = [
    `Title: ${story.title}`,
    `Link: ${story.url ?? "none (a text post)"}`,
    `Posted by ${story.author} · ${story.points} points · ${story.commentCount} comments`,
    ...(story.text ? ["", plainText(story.text).slice(0, 1500)] : []),
    "",
    "Comments: [id] author (depth): text",
  ];
  // Over budget, the editor sees the busiest conversations from the top down (as the writer does).
  for (const id of selectComments(thread, THREAD_CHARS, COMMENT_CHARS)) {
    const c = thread.comments[id];
    const text = plainText(c.html).replace(/\s+/g, " ");
    lines.push(`[${c.id}] ${c.author} (${c.depth}): ${text.length > COMMENT_CHARS ? `${text.slice(0, COMMENT_CHARS)}…` : text}`);
  }
  return lines.join("\n");
}

/** When the editor pass fails: a plain story with the title as the image search. */
function fallback(thread: Thread): EditorNotes {
  return {
    shape: "explainer",
    angle: thread.story.title,
    headline: thread.story.title,
    hook: "",
    cast: [],
    moments: [],
    image: { use: "search", kind: "screenshot", queries: [thread.story.title] },
  };
}

/** Briefs the writer on a thread: its angle, shape, cast, key moments and lead art. */
export async function planEdition(thread: Thread): Promise<EditorNotes> {
  const gateway = new OpenAI({ apiKey: process.env.THESYS_API_KEY, baseURL: "https://api.thesys.dev/v1/embed" });
  try {
    const completion = await gateway.chat.completions.create({
      model: EDITOR_MODEL,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: INSTRUCTIONS },
        { role: "user", content: briefing(thread) },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as Record<string, unknown>;

    // Keep only people and moments that are really in the thread.
    const list = (value: unknown) => (Array.isArray(value) ? (value as Record<string, unknown>[]) : []);
    const cast = list(json.cast)
      .map((p) => ({ comment: getComment(thread, Number(p.id)), who: String(p.who ?? "") }))
      .filter((p) => p.comment && p.who)
      .map((p) => ({ id: p.comment!.id, author: p.comment!.author, who: p.who }))
      .slice(0, 6);
    const moments = list(json.moments)
      .filter((m) => getComment(thread, Number(m.id)))
      .map((m) => ({ id: Number(m.id), why: String(m.why ?? "") }))
      .slice(0, 3);

    const image = (json.image ?? {}) as { kind?: string; queries?: unknown };
    const queries = Array.isArray(image.queries) ? image.queries.map(String).filter(Boolean).slice(0, 2) : [];
    const kind = image.kind === "photo" || image.kind === "diagram" ? image.kind : "screenshot";

    return {
      shape: SHAPES.includes(json.shape as Shape) ? (json.shape as Shape) : "explainer",
      angle: String(json.angle ?? thread.story.title),
      headline: String(json.headline ?? thread.story.title),
      hook: String(json.hook ?? ""),
      cast,
      moments,
      image:
        image.kind === "none" || queries.length === 0
          ? { use: "none", reason: "abstract subject" }
          : { use: "search", kind, queries },
    };
  } catch (error) {
    // The notes are a help, not a requirement: write the edition without them rather than fail.
    console.warn("[editor] model pass failed, writing without notes:", error);
    return fallback(thread);
  }
}

/**
 * The people most likely to be cast, so their profiles can be fetched while the editor reads: the
 * poster, and the authors of the comments that drew the most replies.
 */
export function likelyCast(thread: Thread, count = 15): string[] {
  const byReplies = thread.order.map((id) => thread.comments[id]).sort((a, b) => b.replies - a.replies);
  const names = new Set([thread.story.author]);
  for (const c of byReplies) {
    if (names.size >= count) break;
    names.add(c.author);
  }
  return [...names];
}
