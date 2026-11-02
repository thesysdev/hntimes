import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Thread } from "./thread";

// The copy of a thread an edition was written from. The timeline route, saved runs and quote
// checks all read this copy, so a comment edited or deleted on HN afterwards can't break a page.
// Fetched snapshots go to snapshots/ (git-ignored); data/ holds the checked-in fixtures.

const SNAPSHOTS = path.join(process.cwd(), "snapshots");
const FIXTURES = path.join(process.cwd(), "data");

export async function saveSnapshot(thread: Thread): Promise<void> {
  await mkdir(SNAPSHOTS, { recursive: true });
  await writeFile(path.join(SNAPSHOTS, `${thread.story.id}.json`), JSON.stringify(thread));
}

/** The latest snapshot of a story, falling back to a fixture. */
export async function loadSnapshot(id: string): Promise<Thread | null> {
  if (!/^\d+$/.test(id)) return null;
  for (const dir of [SNAPSHOTS, FIXTURES]) {
    try {
      return JSON.parse(await readFile(path.join(dir, `${id}.json`), "utf8")) as Thread;
    } catch {
      // try the next place
    }
  }
  return null;
}
