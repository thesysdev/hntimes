import styles from "./Dispatch.module.css";

/** What the reporter has done so far, shown to readers while an edition is being reported. */
export type Desk = {
  story?: { title: string; author: string; comments: number; site: string | null };
  brief?: { shape: string; angle: string; headline: string; cast: string[] };
  /** Finished steps, in the order they finished. */
  done: string[];
  /** What's happening now. */
  now: string;
};

/**
 * The page before the edition arrives: a developing story. It starts on HN's own title and
 * swaps in the editor's working headline and angle once the brief is in, so there's something
 * real to read from the first second.
 */
export function Dispatch({ desk }: { desk: Desk }) {
  const { story, brief } = desk;
  return (
    <section className={styles.dispatch} aria-live="polite">
      <p className={styles.kicker}>
        <span className={styles.pulse} aria-hidden />
        Developing story{brief ? ` · ${brief.shape}` : ""}
      </p>
      <h1 className={styles.title} data-draft={!brief || undefined}>
        {brief?.headline ?? story?.title ?? "On the desk"}
      </h1>
      {brief && <p className={styles.dek}>{brief.angle}</p>}
      <ol className={styles.steps}>
        {desk.done.map((step) => (
          <li key={step} className={styles.done}>
            {step}
          </li>
        ))}
        <li className={styles.now}>{desk.now}</li>
      </ol>
    </section>
  );
}
