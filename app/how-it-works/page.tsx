import type { Metadata } from "next";
import { Masthead, PaperFrame } from "@/components/paper";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "How it works · Hackerpaper" };

/** A short explainer: how a thread becomes an edition. */
export default function HowItWorks() {
  return (
    <PaperFrame masthead={<Masthead />}>
      <article className={styles.page}>
        <p className={styles.kicker}>About the paper</p>
        <h1 className={styles.title}>How a Hacker News thread becomes a front page</h1>
        <p className={styles.dek}>
          Swap news.ycombinator.com for this site in any story link, and an editor writes that discussion
          up as a newspaper edition.
        </p>
        <ol className={styles.steps}>
          <li>
            <strong>Reporting.</strong> The agent reads the whole thread, the linked article and earlier HN
            stories from the same site, and an editor picks the angle and the people to quote.
          </li>
          <li>
            <strong>Writing.</strong> A language model writes the edition in OpenUI Lang, a compact language
            for generative UI, choosing from a library of newspaper components: headlines, pull quotes,
            debate panels, timelines, the thread map.
          </li>
          <li>
            <strong>Rendering.</strong> OpenUI streams the program to your browser and renders it as it
            arrives, so the page is set while you watch. Every quote is checked word for word against the
            thread and links to its comment.
          </li>
          <li>
            <strong>Printing.</strong> Finished editions are kept. A story is rewritten while its thread is
            still growing, and frozen once it settles after a day.
          </li>
        </ol>
        <p className={styles.cta}>
          Built with <a href="https://www.openui.com">OpenUI</a>, the open-source framework for generative UI.
        </p>
      </article>
    </PaperFrame>
  );
}
