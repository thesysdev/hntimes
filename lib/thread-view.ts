import type { Thread } from "./thread";
import { MAX_COMMENTS_CHARS, selectComments } from "./thread-prompt";

// The page never needs a whole thread: its components only look up the comments an edition
// refers to (to check quotes and print names). A big thread runs to megabytes, so the page gets
// one of two slim copies instead. The map's shape comes separately, from get_comment_timeline.

/** A thread cut down to some of its comments, with only the links those comments mention. */
function keep(thread: Thread, ids: Iterable<number>): Thread {
  const kept = new Set(ids);
  const links: Thread["links"] = {};
  for (const [url, mentions] of Object.entries(thread.links)) {
    const visible = mentions.filter((id) => kept.has(id));
    if (visible.length > 0) links[url] = visible;
  }
  return {
    ...thread,
    comments: Object.fromEntries(thread.order.filter((id) => kept.has(id)).map((id) => [id, thread.comments[id]])),
    order: thread.order.filter((id) => kept.has(id)),
    links,
  };
}

/**
 * The comments the writer was given (see selectComments): while an edition streams in, it can only
 * refer to these. Up to about 120K characters, against megabytes for the biggest threads.
 */
export function writerView(thread: Thread): Thread {
  return keep(thread, selectComments(thread, MAX_COMMENTS_CHARS));
}

/**
 * The comments a finished edition refers to, and their parents (for "replying to" bylines): what's
 * stored and served with it. Any number in the program that's a comment id counts, as do comments
 * that mention a link the program lists. A few dozen comments, whatever the thread's size.
 */
export function editionView(thread: Thread, program: string): Thread {
  const ids = new Set<number>();
  for (const [match] of program.matchAll(/\d{4,}/g)) if (thread.comments[match]) ids.add(Number(match));
  for (const [url, mentions] of Object.entries(thread.links)) if (program.includes(url)) mentions.forEach((id) => ids.add(id));
  for (const id of [...ids]) {
    const parent = thread.comments[thread.comments[id].parent];
    if (parent) ids.add(parent.id);
  }
  return keep(thread, ids);
}
