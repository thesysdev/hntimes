"use client";

import { Fragment, useMemo } from "react";
import { getComment, hnUserUrl } from "@/lib/thread";
import { HighlightTarget, useQuotedIds } from "./Highlight";
import { useThread } from "./ThreadContext";
import styles from "./Handle.module.css";

/**
 * The people an edition quotes, by username, each with the first comment of theirs it cites (the
 * poster with none). Only these names are linked in the text: linking every commenter would catch
 * handles that are also ordinary words.
 */
export function useSources(): Map<string, number | null> {
  const thread = useThread();
  const quoted = useQuotedIds();
  return useMemo(() => {
    const sources = new Map<string, number | null>([[thread.story.author, null]]);
    for (const id of quoted) {
      const comment = getComment(thread, id);
      if (comment && !sources.get(comment.author)) sources.set(comment.author, id);
    }
    return sources;
  }, [thread, quoted]);
}

/** A username, set in the paper's sans and linked to the profile. Hovering lights their quotes on the map. */
export function Handle({ name, id }: { name: string; id?: number | null }) {
  const link = (
    <a href={hnUserUrl(name)} className={styles.handle} title={`${name} on Hacker News`}>
      {name}
    </a>
  );
  return id ? (
    <HighlightTarget id={id} inline>
      {link}
    </HighlightTarget>
  ) : (
    link
  );
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Links usernames in a stretch of text: anything written as @name (the model marks every handle
 * that way), and the quoted people's names even without the @. The @ itself isn't printed. Any
 * @name is linked, not only people in the page's copy of the thread: the page holds just the
 * comments the edition quotes, and the checker confirms server-side that every @name is real.
 */
export function LinkNames({ text }: { text: string }) {
  const thread = useThread();
  const sources = useSources();
  const pattern = useMemo(() => {
    const byLength = (names: Iterable<string>) => [...names].filter(Boolean).sort((a, b) => b.length - a.length).map(escape);
    // @name in HN's username alphabet (not inside an address); a bare name only for sources, as a whole word.
    return new RegExp(
      `(?<![\\w.])@([A-Za-z0-9_-]{2,15})(?![\\w-])|(?<![\\w@/.-])(${byLength(sources.keys()).join("|") || "(?!)"})(?![\\w@/-])`,
      "g",
    );
  }, [sources]);

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const name = match[1] ?? match[2];
    parts.push(<Fragment key={`t${cursor}`}>{text.slice(cursor, match.index)}</Fragment>);
    parts.push(<Handle key={`h${match.index}`} name={name} id={sources.get(name) ?? firstComment(thread, name)} />);
    cursor = match.index + match[0].length;
  }
  parts.push(<Fragment key="rest">{text.slice(cursor)}</Fragment>);
  return <>{parts}</>;
}

/** A commenter's first comment in the thread, so hovering their name lights them up on the map. */
function firstComment(thread: ReturnType<typeof useThread>, name: string): number | null {
  return thread.order.find((id) => thread.comments[id].author === name) ?? null;
}
