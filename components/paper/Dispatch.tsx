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

/** A story with too little discussion to report on (yet). */
export function TooQuiet({ title }: { title: string }) {
  return (
    <section className={styles.dispatch}>
      <p className={styles.kicker}>Quiet thread</p>
      <h1 className={styles.title} data-draft>
        {title}
      </h1>
      <p className={styles.dek}>
        There isn&rsquo;t enough of a conversation here to report on yet. Come back once readers have had
        their say.
      </p>
    </section>
  );
}
