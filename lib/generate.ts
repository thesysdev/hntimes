import { generateSystemPrompt, type LibrarySpec } from "@openuidev/lang-core";
import OpenAI from "openai";
import { promptOptions } from "@/components/paper/prompt";
import spec from "@/generated/library.spec.json";
import { type EditionImage, fetchArticle, fetchHnThread } from "./agent-tools";
import { cachedArticle } from "./cache";
// Images are off for now (see the lead art note below).
// import { searchImages } from "./agent-tools";
// import { isGenericImage } from "./agent-tools";
import { fetchEarlierStories, fetchProfiles, likelyCast } from "./hn";
import type { Thread } from "./thread";
import { editionPrompt } from "./thread-prompt";

// The edition agent. Given a story it gathers everything first: the thread, then in parallel the
// article, earlier stories from the same site, and the HN profiles of the likely cast. (Lead art is
// off for now.) Then it makes one streamed call to OpenUI Cloud Gateway with all of it in a single
// prompt; the model plans the edition in its own reasoning before writing it. Gateway validates
// and corrects the OpenUI Lang against the catalog while it streams.
//
// Progress goes out as events, one per step (see EditionEvent); /api/edition sends them as NDJSON.
//
// Regenerate the spec when the catalog changes:
//   npx @openuidev/cli generate components/paper/library.tsx --spec --out generated/library.spec.json

/** One step of an edition being written. */
export type EditionEvent =
  | { type: "status"; message: string }
  | { type: "story"; title: string; author: string; comments: number; site: string | null }
  | { type: "thread"; thread: Thread }
  | { type: "source"; name: string; ok: boolean; size: number; ms: number }
  | { type: "warning"; message: string }
  | { type: "text"; delta: string }
  | { type: "done"; model: string; ms: number; firstTokenMs: number }
  | { type: "error"; message: string };

export const REASONING = ["minimal", "low", "medium", "high"] as const; // the values Gateway accepts
export type Reasoning = (typeof REASONING)[number];
/** The model editions are written with, and its reasoning effort. HACKERPAPER_MODEL and
 * HACKERPAPER_REASONING override them (for comparing models locally). */
export const MODEL = process.env.HACKERPAPER_MODEL ?? "openai/gpt-6.1-sol";
export const DEFAULT_REASONING = (process.env.HACKERPAPER_REASONING ?? "medium") as Reasoning;

// The spec file also carries prompt options; Cloud takes those separately, below.
const { root, components, componentGroups, schema } = spec as LibrarySpec;
const systemPrompt = generateSystemPrompt({
  cloud: true,
  library: { root, components, componentGroups, schema },
  promptOptions: { preamble: promptOptions.preamble, additionalRules: promptOptions.additionalRules },
});

// Marks the end of a prefix Gateway may cache (see the Gateway prompt-caching docs).
const cached = (text: string) => ({ type: "text" as const, text, prompt_cache_breakpoint: { mode: "explicit" as const } });

export type Written = { program: string; thread: Thread; label: string; ms: number; firstTokenMs: number };

/** Gathers a story's sources and writes its edition, reporting each step through `emit`. */
export async function writeEdition({
  id,
  model = MODEL,
  effort = DEFAULT_REASONING,
  emit,
  signal,
}: {
  id: string;
  model?: string;
  effort?: Reasoning;
  emit: (event: EditionEvent) => void;
  signal?: AbortSignal;
}): Promise<Written> {
  const apiKey = process.env.THESYS_API_KEY;
  if (!apiKey) throw new Error("THESYS_API_KEY is not set");
  const url = `https://news.ycombinator.com/item?id=${id}`;
  const label = effort ? `${model} (${effort})` : model;
  const started = Date.now();
  const log = (msg: string) => console.log(`[edition ${id}] ${label} +${Date.now() - started}ms ${msg}`);

  /** Runs one source, reporting it as an event. */
  async function source<T>(name: string, status: string, run: () => Promise<T>, size: (result: T) => number) {
    emit({ type: "status", message: status });
    const sourceStarted = Date.now();
    const result = await run();
    const ms = Date.now() - sourceStarted;
    const ok = result !== null && size(result) > 0;
    log(`${name} → ${ok ? `${size(result)} items/chars` : "nothing"} in ${ms}ms`);
    emit({ type: "source", name, ok, size: ok ? size(result) : 0, ms });
    return result;
  }

  /** A source that may fail without sinking the edition: its error becomes a warning and null. */
  const optional = <T,>(name: string, run: () => Promise<T>) => async () =>
    run().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      log(`${name} failed: ${message}`);
      emit({ type: "warning", message: `${name}: ${message}` });
      return null;
    });

  // 1. Gather everything up front. The thread comes first: it holds the article's URL.
  const fetched = await source("fetch_hn_thread", "Reading the thread…", () => fetchHnThread(url), (f) => f?.thread.order.length ?? 0);
  if (!fetched) throw new Error(`Couldn't load the thread for ${url}.`);
  const { thread } = fetched;
  log(`thread from ${fetched.source}: "${thread.story.title}"`);
  const { title, author, commentCount } = thread.story;
  const site = thread.story.url ? new URL(thread.story.url).hostname.replace(/^www\./, "") : null;
  emit({ type: "story", title, author, comments: commentCount, site });
  const storyUrl = thread.story.url;

  // Then, in parallel: the article, earlier stories from the same site, and the HN profiles of the
  // people the story is likely told through. The writer plans the edition itself.
  emit({ type: "status", message: "Reading the article and looking up who's talking…" });
  const [article, earlier, people] = await Promise.all([
    storyUrl
      ? source(
          "fetch_article",
          "Reading the article…",
          optional("fetch_article", () => cachedArticle(storyUrl, () => fetchArticle(storyUrl))),
          (a) => a?.text.length ?? 0,
        )
      : null,
    source("earlier_stories", "Looking up earlier coverage…", optional("earlier_stories", () => fetchEarlierStories(thread.story)), (e) => e?.length ?? 0),
    source("fetch_profiles", "Looking up who's talking…", () => fetchProfiles(likelyCast(thread)), (p) => Object.keys(p).length),
  ]);
  thread.people = people;

  // Lead art is off for now: editions are written without images. When it's back, it needs image
  // search queries (the old editor pass wrote them; see git history), and the article's own
  // preview image beats a search result when it's a real one:
  // const articleImage = article?.image && !isGenericImage(article.image) ? article.image : null;
  // const images: EditionImage[] = articleImage
  //   ? [{ src: articleImage, credit: `Image from ${new URL(storyUrl!).hostname.replace(/^www\./, "")}`, shows: "The article's own preview image." }]
  //   : searched;
  const images: EditionImage[] = [];

  // The article travels with the thread, so the page can check ArticleQuotes against it.
  if (article) thread.article = { url: article.url, text: article.text };
  emit({ type: "thread", thread });

  // 2. One streamed call with all of it.
  emit({ type: "status", message: `Writing with ${label}…` });
  const prompt = editionPrompt(thread, article, images, earlier ?? []);
  log(`prompt: system ${systemPrompt.length} chars, sources ${prompt.length} chars`);
  const gateway = new OpenAI({ apiKey, baseURL: "https://api.thesys.dev/v1/embed" });
  const completion = await gateway.chat.completions.create(
    {
      model,
      ...(effort ? { reasoning_effort: effort } : {}),
      stream: true,
      stream_options: { include_usage: true },
      messages: [
        { role: "system", content: [cached(systemPrompt)] },
        { role: "user", content: [cached(prompt), { type: "text", text: `Write the edition for story ${id}.` }] },
      ],
    },
    { signal },
  );

  let program = "";
  let firstTokenMs = 0;
  for await (const chunk of completion) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) {
      if (!firstTokenMs) {
        firstTokenMs = Date.now() - started;
        log("first token");
      }
      program += text;
      emit({ type: "text", delta: text });
    }
    if (chunk.usage) log(`usage ${JSON.stringify(chunk.usage)}`);
  }
  log(`done: ${program.length} chars`);
  if (!program) throw new Error("The model returned an empty edition.");
  return { program, thread, label, ms: Date.now() - started, firstTokenMs };
}
