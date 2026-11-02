import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { checkBotId } from "botid/server";
import { after } from "next/server";
import { storyIdFrom } from "@/lib/agent-tools";
import { caching, decide, loadEditionRecord } from "@/lib/cache";
import { type EditionEvent, REASONING, type Reasoning, writeEdition } from "@/lib/generate";
import { fetchStory } from "@/lib/hn";
import { bareProgram, follow, replay, startOrJoin } from "@/lib/live";
import { loadSnapshot, saveSnapshot } from "@/lib/snapshots";

// POST /api/edition {url}: a story's edition as NDJSON events (see EditionEvent in lib/generate.ts).
//
// In production the caching rules decide what that means (lib/cache.ts): a cached edition is
// replayed at once; a story under an hour old gets {"type":"building"}; otherwise the edition is
// written, by one writer that every visitor follows live (lib/live.ts). Requests must pass Vercel
// BotID, and only real HN stories with a discussion are ever written.
//
// In development nothing is cached: every request writes afresh, may pick its model and effort,
// and leaves its program in runs/ and its thread in snapshots/ for checking.

/** Writing an edition takes about a minute; following one, as long as it takes. */
export const maxDuration = 300;

const ndjson = (events: AsyncIterable<Record<string, unknown>> | Iterable<Record<string, unknown>>) => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of events) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        controller.close();
      } catch {
        // The visitor left; the run (if any) carries on without them.
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { url?: unknown; model?: unknown; reasoning?: unknown };
  const id = storyIdFrom(String(body.url ?? "").trim());
  if (!id) return Response.json({ error: "Give a Hacker News item URL, like news.ycombinator.com/item?id=123" }, { status: 400 });
  return caching ? cachedEdition(request, Number(id)) : freshEdition(request, id, body);
}

/** Production: serve, follow or start the story's edition, by the caching rules. */
async function cachedEdition(request: Request, id: number) {
  // Bots never reach the LLM. BotID only works on Vercel (it needs Vercel's request headers), so a
  // local production build skips the check; every deployment enforces it.
  if (process.env.VERCEL && (await checkBotId()).isBot) return Response.json({ error: "Access denied" }, { status: 403 });

  const record = await loadEditionRecord(id);
  const story = record?.frozen ? null : await fetchStory(id).catch(() => null);
  const decision = decide(record, story);
  if (!decision) return Response.json({ error: "That isn't a Hacker News story." }, { status: 404 });

  switch (decision.action) {
    case "serve":
      return ndjson(replay(decision.record));
    case "building":
      return ndjson([{ type: "building", readyIn: decision.readyIn }]);
    case "quiet":
      return ndjson([{ type: "quiet" }]);
    case "write": {
      const { run, writing } = await startOrJoin(decision.story, decision.final);
      // The run outlives this request: the edition is finished and stored even if this visitor leaves.
      if (writing) after(() => writing);
      return ndjson(follow(id, run, request.signal));
    }
  }
}

/** Development: write a new edition on every request, with an optional model and effort. */
function freshEdition(request: Request, id: string, body: { model?: unknown; reasoning?: unknown }) {
  // A request may pick another Gateway model and effort (for comparing models).
  if (body.model !== undefined && !/^[a-z0-9-]+\/[a-z0-9.-]+$/.test(String(body.model)))
    return Response.json({ error: "model must be a Gateway model id like openai/gpt-6-sol" }, { status: 400 });
  if (body.reasoning !== undefined && !REASONING.includes(body.reasoning as Reasoning))
    return Response.json({ error: `reasoning must be one of ${REASONING.join(", ")}` }, { status: 400 });
  const model = body.model === undefined ? undefined : String(body.model);
  const effort = body.reasoning as Reasoning | undefined;

  async function* events(): AsyncGenerator<Record<string, unknown>> {
    const queue: EditionEvent[] = [];
    let wake = () => {};
    let finished = false;
    const written = writeEdition({
      id,
      ...(model ? { model, effort } : effort ? { effort } : {}),
      emit: (event) => {
        if (event.type === "thread") void saveSnapshot(event.thread);
        queue.push(event);
        wake();
      },
      signal: request.signal,
    }).finally(() => {
      finished = true;
      wake();
    });
    written.catch(() => {}); // reported below
    while (!finished || queue.length > 0) {
      if (queue.length === 0) await new Promise<void>((resolve) => (wake = resolve));
      while (queue.length > 0) yield queue.shift()!;
    }
    try {
      const { program, label, ms, firstTokenMs } = await written;
      yield { type: "done", model: label, ms, firstTokenMs };
      await saveRun(id, label, program, `first token +${firstTokenMs}ms, done +${ms}ms`);
    } catch (error) {
      yield { type: "error", message: error instanceof Error ? error.message : String(error) };
    }
  }
  return ndjson(events());
}

/**
 * Keeps each edition written in development in runs/ (git-ignored) as a bare program named
 * <story id>--<time>--<model>.oui, so it can be checked: node scripts/check-edition.mjs runs/<file>
 */
async function saveRun(id: string, label: string, raw: string, timing: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(process.cwd(), "runs", `${id}--${stamp}--${label.replace(/[^\w.-]+/g, "_")}.oui`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${bareProgram(raw)}\n`);
  console.log(`[edition ${id}] saved ${path.relative(process.cwd(), file)} (${timing})`);
}

/**
 * GET /api/edition?id=<story id>, in development only: replays the latest saved run of a story
 * (runs/ and its snapshot) through the same NDJSON stream, without calling the model, so the
 * page's design can be reviewed without writing a new edition each time.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") return Response.json({ error: "Not found" }, { status: 404 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const thread = await loadSnapshot(id);
  const runs = (await readdir(path.join(process.cwd(), "runs")).catch(() => [])).filter((f) => f.startsWith(`${id}--`)).sort();
  if (!thread || runs.length === 0) return Response.json({ error: `No saved run for story ${id}` }, { status: 404 });
  const program = await readFile(path.join(process.cwd(), "runs", runs[runs.length - 1]), "utf8");
  const events = [
    { type: "thread", thread },
    { type: "text", delta: program },
    { type: "done", model: `replay of ${runs[runs.length - 1]}`, ms: 0, firstTokenMs: 0 },
  ];
  return new Response(events.map((e) => `${JSON.stringify(e)}\n`).join(""), {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
