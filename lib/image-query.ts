import OpenAI from "openai";
import { plainText, type Thread } from "./thread";

// Lead art for an edition is chosen in two ways, resolved by the edition route:
// 1. the article's own preview image, if it's a real one (isGenericImage weeds out logos and cards);
// 2. otherwise an image search, whose queries come from a quick model pass (planImageSearch).
// Both run alongside the article fetch, so neither waits on the other.

export type SearchPlan =
  | { use: "search"; kind: "screenshot" | "photo" | "diagram"; queries: string[] }
  | { use: "none"; reason: string };

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

const QUERY_MODEL = process.env.HACKERPAPER_QUERY_MODEL ?? "openai/gpt-6.1-terra";

const INSTRUCTIONS = `You pick lead art for a newspaper page about a Hacker News story.
Reply with JSON only: {"kind": "screenshot" | "photo" | "diagram" | "none", "queries": [up to 2 strings]}.
- Name the concrete thing the story is about: the product, project, site, place or object.
- screenshot for software and websites, photo for physical things and places, diagram for technical ideas.
- No faces unless the story is about a well-known public figure.
- Use "none" with no queries when the subject is abstract (advice, opinions, career questions); no picture beats a generic one.`;

/** Writes image search queries for a story from its title, link and post text, or says none fits. */
export async function planImageSearch(thread: Thread): Promise<SearchPlan> {
  // From the title, link and post text only, so it can run alongside the article fetch.
  const { story } = thread;
  const domain = story.url ? new URL(story.url).hostname : "news.ycombinator.com (text post)";
  const excerpt = (story.text ? plainText(story.text) : "").slice(0, 1500);

  const gateway = new OpenAI({ apiKey: process.env.THESYS_API_KEY, baseURL: "https://api.thesys.dev/v1/embed" });
  try {
    const completion = await gateway.chat.completions.create({
      model: QUERY_MODEL,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: INSTRUCTIONS },
        { role: "user", content: `Title: ${story.title}\nLink: ${domain}${excerpt ? `\n\n${excerpt}` : ""}` },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as { kind?: string; queries?: unknown };
    const queries = Array.isArray(json.queries) ? json.queries.map(String).filter(Boolean).slice(0, 2) : [];
    if (json.kind === "none" || queries.length === 0) return { use: "none", reason: "abstract subject" };
    const kind = json.kind === "photo" || json.kind === "diagram" ? json.kind : "screenshot";
    return { use: "search", kind, queries };
  } catch (error) {
    // The plan is a nicety: fall back to searching the title rather than failing the edition.
    console.warn("[image-query] model pass failed, searching the title:", error);
    return { use: "search", kind: "screenshot", queries: [story.title] };
  }
}
