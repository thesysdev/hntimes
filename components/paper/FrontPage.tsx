import Link from "next/link";
import { coverable } from "@/lib/cache";
import type { FrontPageStory } from "@/lib/hn";
import { LeadThread, type TopComment } from "./LeadThread";
import type { ThreadShapeComment } from "@/lib/tools";
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

/** HN's own sections, read off the title prefix, which the headline then drops. */
const SECTIONS = [
  { name: "Show HN", prefix: /^(Show|Launch) HN:\s*/ },
  { name: "Ask HN", prefix: /^(Ask|Tell) HN:\s*/ },
] as const;

type Placed = FrontPageStory & { section: string | null; headline: string };

function place(story: FrontPageStory): Placed {
  const section = SECTIONS.find((s) => s.prefix.test(story.title));
  return { ...story, section: section?.name ?? null, headline: section ? story.title.replace(section.prefix, "") : story.title };
}

function Byline({ story }: { story: Placed }) {
  const domain = domainOf(story.url);
  return (
    <p className={styles.byline}>
      {story.points} points · {story.comments} comments · {ageOf(story.time)}
      {domain && <> · {domain}</>}
    </p>
  );
}

function Headline({
  story,
  size,
  children,
}: {
  story: Placed;
  size: "lead" | "second" | "brief";
  children?: React.ReactNode;
}) {
  return (
    <article className={styles[size]}>
      {size !== "brief" && story.section && <p className={styles.kicker}>{story.section}</p>}
      <h2 className={styles[`${size}Title`]}>
        <Link href={`/item?id=${story.id}`}>{story.headline}</Link>
      </h2>
      <Byline story={story} />
      {children}
    </article>
  );
}

/** The lead story's conversation on the front page: its thread map and most-replied comment. */
export function LeadConversation({
  id,
  comments,
  top,
}: {
  id: number;
  comments: ThreadShapeComment[];
  top: TopComment | null;
}) {
  if (comments.length === 0) return null;
  return (
    <>
      <LeadThread comments={comments} top={top} />
      <Link href={`/item?id=${id}`} className={styles.read}>
        Read the edition →
      </Link>
    </>
  );
}

/** The busiest threads on the page, as a bar chart of comment counts. */
function MostDiscussed({ stories }: { stories: Placed[] }) {
  const top = [...stories].sort((a, b) => b.comments - a.comments).slice(0, 6);
  const most = top[0]?.comments || 1;
  return (
    <section className={styles.chart} aria-label="Most discussed">
      <h3 className={styles.columnTitle}>Most discussed</h3>
      <ol>
        {top.map((story) => (
          <li key={story.id}>
            <Link href={`/item?id=${story.id}`} className={styles.barLabel}>
              {story.headline}
            </Link>
            <span className={styles.bar} style={{ "--share": story.comments / most } as React.CSSProperties}>
              <span className={styles.barValue}>{story.comments.toLocaleString("en-US")}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * HN's front page as a broadsheet. `lead` is extra content for the lead story (its conversation),
 * passed in so the page can stream it after the headlines.: the top story as the lead, the next three beside it, then the
 * rest in sections (the news, Show HN, Ask HN) with the busiest threads charted. Every headline
 * opens that story's edition at /item?id=…, as on HN.
 */
export function FrontPage({ stories, lead: conversation }: { stories: FrontPageStory[]; lead?: React.ReactNode }) {
  // Only stories with an edition (see coverable in lib/cache.ts): too new or too quiet ones are left
  // off, so every headline opens a page.
  const placed = stories.filter((story) => coverable(story)).map(place);
  const [lead, ...rest] = placed;
  if (!lead) return <p className={styles.empty}>The front page is empty right now.</p>;
  const seconds = rest.slice(0, 3);
  const later = rest.slice(3);
  const news = later.filter((s) => !s.section);
  const sections = SECTIONS.map((section) => ({
    name: section.name,
    stories: later.filter((s) => s.section === section.name),
  })).filter((s) => s.stories.length > 0);

  return (
    <section className={styles.front} aria-label="Today's front page">
      <div className={styles.top}>
        <Headline story={lead} size="lead">
          {conversation}
        </Headline>
        <div className={styles.seconds}>
          {seconds.map((story) => (
            <Headline key={story.id} story={story} size="second" />
          ))}
        </div>
      </div>
      <div className={styles.columns}>
        <section className={styles.news}>
          <h3 className={styles.columnTitle}>Also on the front page</h3>
          <div className={styles.newsList}>
            {news.map((story) => (
              <Headline key={story.id} story={story} size="brief" />
            ))}
          </div>
        </section>
        <div className={styles.rail}>
          <MostDiscussed stories={placed} />
          {sections.map((section) => (
            <section key={section.name}>
              <h3 className={styles.columnTitle}>{section.name}</h3>
              {section.stories.map((story) => (
                <Headline key={story.id} story={story} size="brief" />
              ))}
            </section>
          ))}
        </div>
      </div>
      <footer className={styles.colophon}>
        <p>
          Every story here opens as an edition of its thread, written live and set with{" "}
          <a href="https://www.openui.com" className={styles.openui}>
            OpenUI
          </a>
          . Here&rsquo;s <Link href="/how-it-works">how it works</Link>.
        </p>
      </footer>
    </section>
  );
}

/** Held while the front page loads. */
export function FrontPageSkeleton() {
  return <div className={styles.skeleton} aria-busy aria-label="Loading the front page" />;
}
