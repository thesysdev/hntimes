import Link from "next/link";
import type { FrontPageStory } from "@/lib/hn";
import styles from "./FrontPage.module.css";

function domainOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function ageOf(time: number): string {
  const hours = Math.max(0, (Date.now() / 1000 - time) / 3600);
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} minutes ago`;
  if (hours < 48) return `${Math.round(hours)} hours ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function Byline({ story }: { story: FrontPageStory }) {
  const domain = domainOf(story.url);
  return (
    <p className={styles.byline}>
      {story.points} points · {story.comments} comments · {story.author} · {ageOf(story.time)}
      {domain && story.url && (
        <>
          {" · "}
          <a href={story.url} className={styles.source}>
            {domain}
          </a>
        </>
      )}
    </p>
  );
}

/**
 * HN's front page as a newspaper's: the top story as the lead, the rest as a two-column index.
 * Every headline opens the story's edition at /item?id=…, as on HN.
 */
export function FrontPage({ stories }: { stories: FrontPageStory[] }) {
  const [lead, ...rest] = stories;
  if (!lead) return <p className={styles.empty}>The front page is empty right now.</p>;
  return (
    <section className={styles.front} aria-label="Today's front page">
      <article className={styles.lead}>
        <p className={styles.kicker}>Top story</p>
        <h1 className={styles.leadTitle}>
          <Link href={`/item?id=${lead.id}`}>{lead.title}</Link>
        </h1>
        <Byline story={lead} />
      </article>
      <ol className={styles.index} start={2}>
        {rest.map((story) => (
          <li key={story.id} className={styles.story}>
            <h2 className={styles.title}>
              <Link href={`/item?id=${story.id}`}>{story.title}</Link>
            </h2>
            <Byline story={story} />
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Held while the front page loads. */
export function FrontPageSkeleton() {
  return <div className={styles.skeleton} aria-busy aria-label="Loading the front page" />;
}
