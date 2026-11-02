import { createHash } from "node:crypto";
import type { Story } from "./hn";
import { getStore } from "./store";
import type { Thread } from "./thread";
import { CACHE_VERSION } from "./version";

// What Hackerpaper caches, and for how long. Development never caches: every page is fetched and
// every edition written afresh.
//
// - The front page: 15 minutes.
// - Articles fetched through Exa: forever.
// - Editions, by the story's age:
//     under 1 hour   not written: the story is still building
//     1 to 24 hours  written, then rewritten when the edition is more than 6 hours old
//     over 24 hours  written once more after the 24-hour mark, then frozen for good
// - Every edition ever written is kept, as a version; the newest is the one served.

export const caching = process.env.NODE_ENV !== "development";

const HOUR = 3600;
export const FRONT_PAGE_TTL = 15 * 60;
/** Stories younger than this aren't written up yet. */
export const BUILDING_UNTIL = 1 * HOUR;
/** Stories older than this have settled: their next edition is the last. */
export const FROZEN_AFTER = 24 * HOUR;
/** How long an edition of a story that's still developing is served before it's rewritten. */
export const DEVELOPING_TTL = 6 * HOUR;
/** Stories need at least this many comments to be worth an edition (and an LLM call). */
export const MIN_COMMENTS = 5;

const key = (...parts: (string | number)[]) => ["hp", CACHE_VERSION, ...parts].join(":");
export const keys = {
  frontPage: key("front"),
  edition: (id: number) => key("edition", id),
  versions: (id: number) => key("versions", id),
  lock: (id: number) => key("lock", id),
  stream: (id: number, run: string) => key("stream", id, run),
};
const blobs = {
  edition: (id: number, stamp: string) => `${CACHE_VERSION}/editions/${id}/${stamp}.json`,
  thread: (id: number, run: string) => `${CACHE_VERSION}/threads/${id}/${run}.json`,
  article: (url: string) => `${CACHE_VERSION}/articles/${createHash("sha256").update(url).digest("hex").slice(0, 40)}.json`,
};

// ─── Editions ────────────────────────────────────────────────────────────────

/** A finished edition, as stored: the program and the thread it was written from. */
export type EditionDoc = {
  program: string;
  thread: Thread;
  model: string;
  writtenAt: number;
  /** The story's age when this edition was written, in seconds. */
  storyAge: number;
  frozen: boolean;
};

/** The pointer to a story's newest edition (and the entry for it in the version list). */
export type EditionRecord = Omit<EditionDoc, "program" | "thread"> & { blob: string };

export async function loadEditionRecord(id: number): Promise<EditionRecord | null> {
  return getStore().get<EditionRecord>(keys.edition(id));
}

export async function loadEdition(record: EditionRecord): Promise<EditionDoc | null> {
  const raw = await getStore().getBlob(record.blob);
  return raw ? (JSON.parse(raw) as EditionDoc) : null;
}

/** Stores a finished edition as a new version, and makes it the one served. */
export async function saveEdition(id: number, doc: EditionDoc): Promise<EditionRecord> {
  const store = getStore();
  const blob = blobs.edition(id, new Date(doc.writtenAt).toISOString().replace(/[:.]/g, "-"));
  await store.putBlob(blob, JSON.stringify(doc));
  const record: EditionRecord = {
    model: doc.model,
    writtenAt: doc.writtenAt,
    storyAge: doc.storyAge,
    frozen: doc.frozen,
    blob,
  };
  // The version list never expires; a 10-year TTL keeps append() from adding one.
  await store.append(keys.versions(id), [JSON.stringify(record)], 10 * 365 * 24 * HOUR);
  await store.set(keys.edition(id), record);
  return record;
}

/** What to do for a story right now. */
export type Decision =
  | { action: "serve"; record: EditionRecord }
  | { action: "building"; story: Story; readyIn: number }
  | { action: "quiet"; story: Story }
  | { action: "write"; story: Story; final: boolean };

/**
 * The caching rules for one story. `story` is null when the id isn't an HN story (a comment, job,
 * poll or nothing at all); then there's nothing to write. A frozen edition is served without
 * looking the story up at all.
 */
export function decide(record: EditionRecord | null, story: Story | null, now = Date.now() / 1000): Decision | null {
  if (record?.frozen) return { action: "serve", record };
  if (!story) return null;
  const age = now - story.time;
  if (age < BUILDING_UNTIL) return { action: "building", story, readyIn: BUILDING_UNTIL - age };
  if (story.comments < MIN_COMMENTS) return record ? { action: "serve", record } : { action: "quiet", story };
  if (age >= FROZEN_AFTER) return { action: "write", story, final: true };
  if (record && now - record.writtenAt / 1000 < DEVELOPING_TTL) return { action: "serve", record };
  return { action: "write", story, final: false };
}

// ─── Live streams ────────────────────────────────────────────────────────────

/** A run in progress: the writer holds the story's lock with this. */
export type Run = { run: string; started: number };

/** How long a writer may hold a story before others assume it died. */
export const LOCK_TTL = 4 * 60;
/** How long a run's events are kept, for late joiners. */
export const STREAM_TTL = 15 * 60;

export function saveRunThread(id: number, run: string, thread: Thread): Promise<void> {
  return getStore().putBlob(blobs.thread(id, run), JSON.stringify(thread));
}

export async function loadRunThread(id: number, run: string): Promise<Thread | null> {
  const raw = await getStore().getBlob(blobs.thread(id, run));
  return raw ? (JSON.parse(raw) as Thread) : null;
}

/** The latest thread for a story: the newest edition's, or the one being written now. */
export async function loadLatestThread(id: number): Promise<Thread | null> {
  const store = getStore();
  const running = await store.get<Run>(keys.lock(id));
  if (running) {
    const thread = await loadRunThread(id, running.run);
    if (thread) return thread;
  }
  const record = await loadEditionRecord(id);
  return record ? ((await loadEdition(record))?.thread ?? null) : null;
}

// ─── Articles and the front page ────────────────────────────────────────────

/** An article fetched once is kept forever (per cache version). Failures aren't cached. */
export async function cachedArticle<T>(url: string, fetch: () => Promise<T | null>): Promise<T | null> {
  if (!caching) return fetch();
  const store = getStore();
  const hit = await store.getBlob(blobs.article(url));
  if (hit) return JSON.parse(hit) as T;
  const article = await fetch();
  if (article) await store.putBlob(blobs.article(url), JSON.stringify(article));
  return article;
}

/** A value kept for `ttl` seconds under `key`. */
export async function cachedFor<T>(cacheKey: string, ttl: number, fetch: () => Promise<T>): Promise<T> {
  if (!caching) return fetch();
  const store = getStore();
  const hit = await store.get<T>(cacheKey);
  if (hit !== null) return hit;
  const value = await fetch();
  await store.set(cacheKey, value, ttl);
  return value;
}
