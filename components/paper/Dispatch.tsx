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

/**
 * A story too young to report: the thread is still taking shape, so no edition is written until
 * it's an hour old.
 */
export function StillBuilding({ title, readyIn }: { title: string; /** Seconds until it's an hour old. */ readyIn: number }) {
  const minutes = Math.max(1, Math.ceil(readyIn / 60));
  return (
    <section className={styles.dispatch}>
      <p className={styles.kicker}>
        <span className={styles.pulse} aria-hidden />
        Developing story
      </p>
      <h1 className={styles.title} data-draft>
        {title}
      </h1>
      <p className={styles.dek}>
        This story is still building. Come back as it develops: the first edition is written once the
        discussion is an hour old, in about {minutes} {minutes === 1 ? "minute" : "minutes"}.
      </p>
    </section>
  );
}

/**
 * A story below the bar for an edition (see MIN_POINTS_* in lib/cache.ts): not yet, or, once it
 * has settled, not at all.
 */
export function TooQuiet({ title, settled }: { title: string; settled: boolean }) {
  return (
    <section className={styles.dispatch}>
      <p className={styles.kicker}>{settled ? "Not covered" : "Developing story"}</p>
      <h1 className={styles.title} data-draft>
        {title}
      </h1>
      <p className={styles.dek}>
        {settled
          ? "Hackerpaper covers stories that reached 100 points and drew a discussion. This one didn’t."
          : "Hackerpaper writes up stories once readers start talking. This one isn’t there yet: come back as it develops."}
      </p>
    </section>
  );
}
