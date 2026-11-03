import { randomUUID } from "node:crypto";
import { parseMessage } from "@openuidev/lang-core";
import {
  type EditionRecord,
  keys,
  loadEdition,
  loadRunView,
  LOCK_TTL,
  type Run,
  saveEdition,
  saveRunThread,
  STREAM_TTL,
} from "./cache";
import { type EditionEvent, writeEdition } from "./generate";
import type { Story } from "./hn";
import { getStore } from "./store";
import { repairQuotes } from "./thread";
import { editionView, writerView } from "./thread-view";
import { getCommentTimeline } from "./tools";

// One writer per story, everyone else watching. The first visitor to need a new edition takes the
// story's lock and starts writing; the run's events go to a shared list as they happen. Every
// visitor, the writer's own included, follows that list from the start, so a latecomer sees the
// edition written from the top. The run carries on if its visitor leaves, and the finished edition
// is stored as a new version.

/** How often followers check for new events. */
const POLL_MS = 300;
/** How often the writer flushes events to the list. */
const FLUSH_MS = 250;
/** A follower gives up when a run has gone this long without a word. */
const SILENCE_MS = 90_000;

/** The bare program inside Gateway's envelope and fence, as stored and served. */
export function bareProgram(raw: string): string {
  const { content } = parseMessage(raw);
  return content.replace(/^\s*```[\w-]*\n/, "").replace(/\n?```\s*$/, "");
}

/**
 * Starts writing a story's edition unless someone already is. Returns the run to follow, and the
 * writing itself when this call started it (so the caller can keep the process alive for it).
 */
export async function startOrJoin(story: Story, final: boolean): Promise<{ run: string; writing: Promise<void> | null }> {
  const store = getStore();
  const mine: Run = { run: randomUUID(), started: Date.now() };
  if (!(await store.claim(keys.lock(story.id), mine, LOCK_TTL))) {
    const theirs = await store.get<Run>(keys.lock(story.id));
    // The lock expired between the two calls: try once more.
    if (!theirs) return startOrJoin(story, final);
    return { run: theirs.run, writing: null };
  }
  return { run: mine.run, writing: write(story, final, mine.run) };
}

/** Writes the edition, publishing its events, and stores it. Never throws. */
async function write(story: Story, final: boolean, run: string): Promise<void> {
  const store = getStore();
  const list = keys.stream(story.id, run);
  let pending: string[] = [];
  let flushing = Promise.resolve();
  const flush = () => {
    const batch = pending;
    pending = [];
    flushing = flushing.then(() => store.append(list, batch, STREAM_TTL)).catch((error) => {
      console.error(`[edition ${story.id}] couldn't publish events:`, error);
    });
    return flushing;
  };
  const timer = setInterval(flush, FLUSH_MS);
  const threadSaved: Promise<void>[] = [];

  const emit = (event: EditionEvent) => {
    if (event.type === "thread") {
      // Threads run to megabytes: they go to blob storage, and the list just says they're there.
      // Visitors get the writer's view, the only comments the edition can refer to.
      const saved = saveRunThread(story.id, run, event.thread, writerView(event.thread));
      threadSaved.push(saved);
      void saved.then(() => pending.push(JSON.stringify({ type: "thread-ready" })));
      return;
    }
    pending.push(JSON.stringify(event));
  };

  try {
    const written = await writeEdition({ id: String(story.id), emit });
    await Promise.all(threadSaved);
    const writtenAt = Date.now();
    const program = repairQuotes(bareProgram(written.program), written.thread);
    await saveEdition(story.id, {
      program,
      thread: editionView(written.thread, program),
      timeline: getCommentTimeline(written.thread, { id: story.id }).comments,
      model: written.label,
      writtenAt,
      storyAge: Math.round(writtenAt / 1000 - story.time),
      frozen: final,
    });
    emit({ type: "done", model: written.label, ms: written.ms, firstTokenMs: written.firstTokenMs });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[edition ${story.id}] failed:`, message);
    emit({ type: "error", message: "The edition couldn't be written. Try again in a few minutes." });
  } finally {
    clearInterval(timer);
    await flush();
    await store.del(keys.lock(story.id));
  }
}

/** A finished edition as the same events a live run sends: the thread, the whole program, done. */
export async function* replay(record: EditionRecord): AsyncGenerator<Record<string, unknown>> {
  const doc = await loadEdition(record);
  if (!doc) {
    yield { type: "error", message: "This edition couldn't be loaded." };
    return;
  }
  yield { type: "thread", thread: doc.thread };
  yield { type: "text", delta: doc.program };
  yield { type: "done", model: doc.model, ms: 0, firstTokenMs: 0 };
}

/** Follows a run's events from the start until it finishes, fails, or falls silent. */
export async function* follow(id: number, run: string, signal: AbortSignal): AsyncGenerator<Record<string, unknown>> {
  const store = getStore();
  const list = keys.stream(id, run);
  let cursor = 0;
  let lastNews = Date.now();
  while (!signal.aborted) {
    const items = await store.read(list, cursor);
    cursor += items.length;
    if (items.length > 0) lastNews = Date.now();
    for (const item of items) {
      const event = JSON.parse(item) as { type: string };
      if (event.type === "thread-ready") {
        const thread = await loadRunView(id, run);
        if (thread) yield { type: "thread", thread };
        continue;
      }
      yield event;
      if (event.type === "done" || event.type === "error") return;
    }
    if (Date.now() - lastNews > SILENCE_MS) {
      yield { type: "error", message: "The edition stopped arriving. Try again in a few minutes." };
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}
