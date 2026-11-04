import Link from "next/link";
import styles from "./Masthead.module.css";
import { ThemeToggle } from "./ThemeToggle";
import { Today } from "./Today";

type Props = {
  /** The HN story id; omitted until the story is known. */
  edition?: number;
};

/** Page chrome: the nameplate over a ruled folio line. Rendered by the app, never by the model. */
export function Masthead({ edition }: Props) {
  return (
    <header className={styles.masthead}>
      <Link href="/" className={styles.wordmark}>
        Hackerpaper
      </Link>
      <div className={styles.folio}>
        <span className={styles.date}>
          <Today />
        </span>
        <span className={styles.tagline}>HN discussion, if it had an editor</span>
        <span className={styles.end}>
          {edition ? <span className={styles.edition}>No. {edition}</span> : null}
          <ThemeToggle />
        </span>
      </div>
    </header>
  );
}
