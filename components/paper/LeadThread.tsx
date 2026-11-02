"use client";

import { hnItemUrl, hnUserUrl } from "@/lib/thread";
import type { ThreadShapeComment } from "@/lib/tools";
import { HighlightProvider, HighlightTarget } from "./Highlight";
import { ThreadMap } from "./ThreadMap";
import styles from "./FrontPage.module.css";

export type TopComment = { id: number; author: string; text: string; replies: number };

/** The lead story's conversation on the front page: its thread map, and the comment that drew the most replies. */
export function LeadThread({ comments, top }: { comments: ThreadShapeComment[]; top: TopComment | null }) {
  return (
    <HighlightProvider>
      {top && (
        <HighlightTarget id={top.id} className={styles.topComment}>
          <p className={styles.topLabel}>Most-replied comment · {top.replies} replies</p>
          <a href={hnItemUrl(top.id)} className={styles.topText}>
            {top.text}
          </a>
          <a href={hnUserUrl(top.author)} className={styles.topAuthor}>
            {top.author}
          </a>
        </HighlightTarget>
      )}
      <ThreadMap
        comments={comments}
        quoted={top ? [top.id] : []}
        caption={top && <>The orange dot is the most-replied comment.</>}
      />
    </HighlightProvider>
  );
}
