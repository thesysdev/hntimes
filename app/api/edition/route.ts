import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateSystemPrompt, parseMessage, type LibrarySpec } from "@openuidev/lang-core";
import OpenAI from "openai";
import { promptOptions } from "@/components/paper/prompt";
import spec from "@/generated/library.spec.json";
import { type EditionImage, fetchArticle, fetchHnThread, searchImages, storyIdFrom } from "@/lib/agent-tools";
import { isGenericImage, planImageSearch } from "@/lib/image-query";
import { saveSnapshot } from "@/lib/snapshots";
import { editionPrompt } from "@/lib/thread-prompt";

// The edition agent. Given an HN URL it gathers everything first: the thread, then the article and
// the image search in parallel. Then it makes one streamed call to OpenUI Cloud Gateway with all of
// it in a single prompt. Gateway validates and corrects the OpenUI Lang against the catalog while
// it streams.
//
// The response is NDJSON, one event per line:
//   {"type":"status","message":"…"}       progress
//   {"type":"thread","thread":{…}}        the fetched thread, which the page needs to render quotes
//   {"type":"source",…}                   a source finished (name, ok, size, ms)
//   {"type":"warning","message":"…"}      an optional source failed (the edition goes on without it)
//   {"type":"text","delta":"…"}           a piece of the program (raw, in Gateway's envelope)
//   {"type":"done",…} / {"type":"error",…}
//
// Regenerate the spec when the catalog changes:
//   npx @openuidev/cli generate components/paper/library.tsx --spec --out generated/library.spec.json

const MODEL = process.env.HACKERPAPER_MODEL ?? "openai/gpt-6.1-sol";
const REASONING = ["minimal", "low", "medium", "high"] as const; // the values Gateway accepts
type Reasoning = (typeof REASONING)[number];
/** Default reasoning effort; unset means the model's own default. */
const DEFAULT_REASONING = process.env.HACKERPAPER_REASONING as Reasoning | undefined;

// The spec file also carries prompt options; Cloud takes those separately, below.
const { root, components, componentGroups, schema } = spec as LibrarySpec;
const systemPrompt = generateSystemPrompt({
  cloud: true,
  library: { root, components, componentGroups, schema },
  promptOptions: { preamble: promptOptions.preamble, additionalRules: promptOptions.additionalRules },
});

// Marks the end of a prefix Gateway may cache (see the Gateway prompt-caching docs).
const cached = (text: string) => ({ type: "text" as const, text, prompt_cache_breakpoint: { mode: "explicit" as const } });

/**
 * Keeps each finished edition in runs/ (git-ignored) as a bare program named
 * <story id>--<time>--<model>.oui, so it can be checked: node scripts/check-edition.mjs runs/<file>
 */
async function saveRun(id: string, label: string, raw: string, timing: string) {
  const { content } = parseMessage(raw);
  const program = content.replace(/^\s*```[\w-]*\n/, "").replace(/\n?```\s*$/, "");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(process.cwd(), "runs", `${id}--${stamp}--${label.replace(/[^\w.-]+/g, "_")}.oui`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${program}\n`);
  console.log(`[edition ${id}] saved ${path.relative(process.cwd(), file)} (${timing})`);
}

export async function POST(request: Request) {
  const apiKey = process.env.THESYS_API_KEY;
  if (!apiKey) return Response.json({ error: "THESYS_API_KEY is not set" }, { status: 500 });

  const body = (await request.json().catch(() => ({}))) as { url?: unknown; model?: unknown; reasoning?: unknown };
  const url = String(body.url ?? "").trim();
  const id = storyIdFrom(url);
  if (!id) return Response.json({ error: "Give a Hacker News item URL, like news.ycombinator.com/item?id=123" }, { status: 400 });

  // A request may pick another Gateway model and effort (for comparing models).
  if (body.model !== undefined && !/^[a-z0-9-]+\/[a-z0-9.-]+$/.test(String(body.model)))
    return Response.json({ error: "model must be a Gateway model id like openai/gpt-6-sol" }, { status: 400 });
  if (body.reasoning !== undefined && !REASONING.includes(body.reasoning as Reasoning))
    return Response.json({ error: `reasoning must be one of ${REASONING.join(", ")}` }, { status: 400 });
  const model = body.model === undefined ? MODEL : String(body.model);
  const effort = (body.reasoning as Reasoning | undefined) ?? (body.model === undefined ? DEFAULT_REASONING : undefined);

  const label = effort ? `${model} (${effort})` : model;
  const started = Date.now();
  const log = (msg: string) => console.log(`[edition ${id}] ${label} +${Date.now() - started}ms ${msg}`);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Once the page goes away (closed, reloaded), events have nowhere to go: drop them quietly.
      let open = true;
      const send = (event: Record<string, unknown>) => {
        if (!open || request.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false;
        }
      };
      const close = () => {
        if (!open) return;
        open = false;
        try {
          controller.close();
        } catch {
          // already closed by the client
        }
      };
      /** Runs one source, reporting it as an event. */
      async function source<T>(name: string, status: string, run: () => Promise<T>, size: (result: T) => number) {
        send({ type: "status", message: status });
        const sourceStarted = Date.now();
        const result = await run();
        const ms = Date.now() - sourceStarted;
        const ok = result !== null && size(result) > 0;
        log(`${name} → ${ok ? `${size(result)} items/chars` : "nothing"} in ${ms}ms`);
        send({ type: "source", name, ok, size: ok ? size(result) : 0, ms });
        return result;
      }

      /** A source that may fail without sinking the edition: its error becomes a warning and null. */
      const optional = <T,>(name: string, run: () => Promise<T>) => async () =>
        run().catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          log(`${name} failed: ${message}`);
          send({ type: "warning", message: `${name}: ${message}` });
          return null;
        });

      try {
        // 1. Gather everything up front. The thread comes first: it holds the article's URL.
        const fetched = await source("fetch_hn_thread", "Reading the thread…", () => fetchHnThread(url), (f) => f?.thread.order.length ?? 0);
        if (!fetched) throw new Error(`Couldn't load the thread for ${url}.`);
        const { thread } = fetched;
        log(`thread from ${fetched.source}: "${thread.story.title}"`);
        const storyUrl = thread.story.url;

        // Then, in parallel: the article, and the image search (its queries, then the search).
        send({ type: "status", message: "Reading the article and finding images…" });
        const [article, searched] = await Promise.all([
          storyUrl
            ? source("fetch_article", "Reading the article…", optional("fetch_article", () => fetchArticle(storyUrl)), (a) => a?.text.length ?? 0)
            : null,
          source("plan_image", "Choosing the lead art…", () => planImageSearch(thread), (p) => (p.use === "none" ? 0 : 1)).then(
            (plan): Promise<EditionImage[]> => {
              log(`image plan: ${JSON.stringify(plan)}`);
              if (plan.use === "none") return Promise.resolve([]);
              const query = plan.queries[0];
              return source("search_images", `Searching for “${query}”…`, () => searchImages(query), (i) => i.length);
            },
          ),
        ]);

        // The article's own preview image beats a search result when it's a real one.
        const articleImage = article?.image && !isGenericImage(article.image) ? article.image : null;
        const images: EditionImage[] = articleImage
          ? [{ src: articleImage, credit: `Image from ${new URL(storyUrl!).hostname.replace(/^www\./, "")}`, shows: "The article's own preview image." }]
          : searched;

        // The article travels with the thread, so the page can check ArticleQuotes against it.
        if (article) thread.article = { url: article.url, text: article.text };
        await saveSnapshot(thread);
        send({ type: "thread", thread });

        // 2. One streamed call with all of it.
        send({ type: "status", message: `Writing with ${label}…` });
        const prompt = editionPrompt(thread, article, images);
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
          { signal: request.signal },
        );

        let program = "";
        let firstToken = 0;
        for await (const chunk of completion) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) {
            if (!firstToken) {
              firstToken = Date.now() - started;
              log("first token");
            }
            program += text;
            send({ type: "text", delta: text });
          }
          if (chunk.usage) log(`usage ${JSON.stringify(chunk.usage)}`);
        }

        log(`done: ${program.length} chars`);
        send({ type: "done", model: label, ms: Date.now() - started, firstTokenMs: firstToken });
        close();
        if (program) await saveRun(id, label, program, `first token +${firstToken}ms, done +${Date.now() - started}ms`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`error: ${message}`);
        send({ type: "error", message });
        close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Model": label },
  });
}
