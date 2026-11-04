import type { Metadata } from "next";
import { Masthead, PaperFrame } from "@/components/paper";
import { BUILDING_UNTIL, DEVELOPING_TTL, FROZEN_AFTER, MIN_COMMENTS, MIN_POINTS_DEVELOPING, MIN_POINTS_SETTLED } from "@/lib/cache";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "About · Hackerpaper" };

const hours = (seconds: number) => seconds / 3600;

/** What Hackerpaper is, how to read an edition, and how one is made. */
export default function About() {
  return (
    <PaperFrame masthead={<Masthead />}>
      <article className={styles.page}>
        <p className={styles.kicker}>About the paper</p>
        <h1 className={styles.title}>Hacker News discussions, written up as news</h1>
        <p className={styles.dek}>
          Every story on Hacker News comes with a thread, and the thread is often the better story: the
          engineer who corrects the article, the argument that changes course, the question nobody can
          answer. Hackerpaper reads those threads and reports them the way a newspaper would.
        </p>

        <section className={styles.section}>
          <h2>What&rsquo;s in an edition</h2>
          <dl className={styles.parts}>
            <dt>The headline</dt>
            <dd>What happened in the thread, with a line on what the link is and how readers took it.</dd>
            <dt>The thread map</dt>
            <dd>
              Every comment, placed by when it was posted and how deep in the conversation it sits. The
              comments the edition quotes are marked.
            </dd>
            <dt>The story</dt>
            <dd>
              Four to six sections whose headings, read top to bottom, tell the story. A thread that turned
              (new information, a correction, a change of mind) is told as a narrative; one where people
              weighed in side by side is told as a portrait of what they brought. The last section says what
              is clear from the comments, what isn&rsquo;t, and what remains to be seen.
            </dd>
            <dt>The sidebar</dt>
            <dd>Key points about the link itself, the people involved, open questions and further reading.</dd>
          </dl>
          <p>
            Quotes are word for word and link to their comments; names link to HN profiles. Notes marked ◆
            are background added by the writer, not taken from the thread.
          </p>
        </section>

        <section className={styles.section}>
          <h2>How it reports</h2>
          <p>
            The paper takes no side. When readers disagree, it counts the people (not the comments) on each
            side and says how they divided. &ldquo;Most readers&rdquo; means at least three to one among ten or
            more people; &ldquo;more readers&rdquo; means two to one among six or more; anything closer is a
            split. Fewer than six people are &ldquo;a few readers&rdquo;, never the crowd.
          </p>
        </section>

        <section className={styles.section}>
          <h2>How an edition is made</h2>
          <ol className={styles.steps}>
            <li>
              <strong>Reporting.</strong> The thread comes from HN&rsquo;s Algolia API, the linked article from
              Exa, along with earlier HN stories from the same site and the HN profiles of the poster and the
              commenters who drew the most replies. Very large threads are trimmed to the comments that drew
              the most replies.
            </li>
            <li>
              <strong>Writing.</strong> A language model plans the story and writes the edition in OpenUI
              Lang, a compact language for Generative UI, choosing from a library of newspaper components:
              headlines, pull quotes, debate panels, timelines, the thread map.
            </li>
            <li>
              <strong>Checking.</strong> Every quote is matched word for word against the thread. A quote
              that can&rsquo;t be found isn&rsquo;t printed.
            </li>
            <li>
              <strong>Setting.</strong> OpenUI streams the program to your browser and renders it as it
              arrives, so you watch the page being set.
            </li>
          </ol>
        </section>

        <section className={styles.section}>
          <h2>What gets covered, and when</h2>
          <ul className={styles.rules}>
            <li>
              A story younger than {hours(BUILDING_UNTIL)} hour is still building: its thread hasn&rsquo;t
              found its shape yet.
            </li>
            <li>
              An edition needs at least {MIN_COMMENTS} comments and {MIN_POINTS_DEVELOPING} points, or{" "}
              {MIN_POINTS_SETTLED} points once the story is a day old. The front page lists only stories that
              qualify.
            </li>
            <li>
              While a story is under {hours(FROZEN_AFTER)} hours old, its edition is rewritten every{" "}
              {hours(DEVELOPING_TTL)} hours as the thread grows. After that, one final edition is written and
              kept.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>Any thread</h2>
          <p>
            Replace news.ycombinator.com with this site&rsquo;s address in any HN item link, and that
            discussion opens as an edition.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Limits</h2>
          <p>
            A language model writes every edition, and it can misread a thread: take a joke straight, or
            miscount a side. The comments are the record, and every quote links back to them.
          </p>
        </section>

        <p className={styles.cta}>
          Built with <a href="https://www.openui.com">OpenUI</a>, the open-source framework for Generative UI.
        </p>
      </article>
    </PaperFrame>
  );
}
