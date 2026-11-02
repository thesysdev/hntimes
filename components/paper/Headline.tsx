import { hnItemUrl } from "@/lib/thread";
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
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.dek}>{dek}</p>
      <div className={styles.byline}>
        <p className={styles.bylineName}>
          From a <a href={hnItemUrl(story.id)}>Hacker News thread</a> started by {story.author}
        </p>
        <p className={styles.bylineMeta}>
          {newspaperDate(story.time)} · {story.points.toLocaleString("en-US")} points ·{" "}
          {story.commentCount} comments
        </p>
      </div>
    </header>
  );
}

export function Lede({ children }: { children: React.ReactNode }) {
  return (
    // One column, across the story: the opening paragraph should read in one go.
    <p className={styles.lede}>{children}</p>
  );
}
