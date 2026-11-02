import { getComment } from "@/lib/thread";
import { useThread } from "./ThreadContext";
import { Citation, type QuoteRef } from "./Quote";
import styles from "./Positions.module.css";
import { LinkNames } from "./Handle";

type Side = {
  label: string;
  summary: string;
  quotes: QuoteRef[];
};

/** At most this many sides, in one row. */
const MAX_SIDES = 3;

/** Keeps the first two sides and folds the rest into a single "Others" side. */
function foldSides(sides: Side[]): Side[] {
  if (sides.length <= MAX_SIDES) return sides;
  const kept = sides.slice(0, MAX_SIDES - 1);
  const rest = sides.slice(MAX_SIDES - 1);
  return [
    ...kept,
    {
      label: "Others",
      // Just the folded sides' labels: their full summaries would make this column much longer.
      summary: `Also argued: ${rest.map((s) => s.label).join("; ")}.`,
      quotes: rest.flatMap((s) => s.quotes),
    },
  ];
}

/**
 * Where the thread splits, as up to three sides in one row. The lean bar is computed from how many
 * cited comments back each side, never from numbers the editor supplies, and it doesn't pick a winner.
 */
export function Positions({ question, sides }: { question: string; sides: Side[] }) {
  const thread = useThread();
  const counted = foldSides(sides).map((s) => ({
    ...s,
    quotes: s.quotes.filter((q) => getComment(thread, q.id)),
  }));
  const total = counted.reduce((n, s) => n + s.quotes.length, 0);
  if (total === 0) return null;

  return (
    // data-linear: sides sit next to each other, so its section is never set in columns.
    <figure className={styles.positions} data-linear="full">
      <figcaption className={styles.question}>
        <LinkNames text={question} />
      </figcaption>
      <div className={styles.lean} aria-hidden>
        {counted.map((s, i) => (
          <span key={s.label} style={{ flexGrow: s.quotes.length }} data-side={i} />
        ))}
      </div>
      <p className={styles.leanNote}>
        Split of the {total} comments cited below, not of the whole thread.
      </p>
      <div className={styles.sides} style={{ "--sides": counted.length } as React.CSSProperties}>
        {counted.map((s, i) => (
          <section key={s.label} className={styles.side} data-side={i}>
            <h3 className={styles.label}>
              {s.label} <span className={styles.count}>{s.quotes.length}</span>
            </h3>
            <p className={styles.summary}>
              <LinkNames text={s.summary} />
            </p>
            <div>
              {s.quotes.map((q, j) => (
                <Citation key={`${q.id}-${j}`} {...q} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </figure>
  );
}
