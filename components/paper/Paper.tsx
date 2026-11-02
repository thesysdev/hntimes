import type { Thread } from "@/lib/thread";
import { HighlightProvider } from "./Highlight";
import { ThreadProvider } from "./ThreadContext";
import styles from "./Paper.module.css";

/** Page frame: masthead, then the edition, with the thread available to every component. */
export function Paper({
  thread,
  masthead,
  children,
}: {
  thread: Thread;
  masthead: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <PaperFrame masthead={masthead}>
      <ThreadProvider thread={thread}>
        <HighlightProvider>{children}</HighlightProvider>
      </ThreadProvider>
    </PaperFrame>
  );
}

/** The page frame alone, for pages that get their thread later (the live desk). */
export function PaperFrame({ masthead, children }: { masthead: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      {masthead}
      {children}
    </div>
  );
}

/** The sheet: a broadsheet grid. Everything spans it except the Story and Sidebar. */
export function Edition({ children }: { children: React.ReactNode }) {
  return <article className={styles.sheet}>{children}</article>;
}

/** The main story, set in columns. */
export function Story({ children }: { children: React.ReactNode }) {
  return <div data-slot="story">{children}</div>;
}

/** The sidebar beside the story: summaries, questions, lists. Never set in columns. */
export function Sidebar({ children }: { children: React.ReactNode }) {
  return (
    <aside data-slot="sidebar" className={styles.sidebar}>
      {children}
    </aside>
  );
}
