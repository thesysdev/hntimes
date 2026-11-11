import { hnItemUrl, hnUserUrl } from "@/lib/thread";
import { LinkNames } from "./Handle";
import type { QuoteRef } from "./Quote";
import { weave } from "./Section";
import { useThread } from "./ThreadContext";
import styles from "./Headline.module.css";

type HeadlineProps = {
  kicker: string;
  title: string;
  dek: string;
};

// Newspaper (AP) month style: short months take a period, March–July are spelled out.
const MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];

function newspaperDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function Headline({ kicker, title, dek }: HeadlineProps) {
  const { story } = useThread();
  return (
    <header className={styles.headline}>
      <p className={styles.kicker}>{kicker}</p>
      <h1 className={styles.title}>
        <LinkNames text={title} />
      </h1>
      <p className={styles.dek}>
        <LinkNames text={dek} />
      </p>
      <div className={styles.byline}>
        <p className={styles.bylineName}>
          From a <a href={hnItemUrl(story.id)}>Hacker News thread</a> started by{" "}
          <a href={hnUserUrl(story.author)}>{story.author}</a>
        </p>
        <p className={styles.bylineMeta}>
          {newspaperDate(story.time)} · {story.points.toLocaleString("en-US")} points ·{" "}
          {story.commentCount} comments
        </p>
      </div>
    </header>
  );
}

/** The opening paragraph. Like Prose, it may weave in cited excerpts at `{1}`, `{2}`… */
export function Lede({ text, cites = [] }: { text: string; cites?: QuoteRef[] }) {
  return (
    // One column, across the story: the opening paragraph should read in one go.
    <p className={styles.lede}>{weave(text, cites)}</p>
  );
}
