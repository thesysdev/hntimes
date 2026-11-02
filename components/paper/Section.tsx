import { Fragment } from "react";
import { Cite, type QuoteRef } from "./Quote";
import { Term, TermNote } from "./Sidenote";
import styles from "./Section.module.css";

/** A titled part of the page. In the story its body is set in columns; in the sidebar it isn't. */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.title}>{title}</h2>
      <div data-columns>{children}</div>
    </section>
  );
}

export type TermDefinition = { term: string; definition: string };

/** Splits text at the first occurrence of each term, so the term can be marked inline. */
function markTerms(text: string, terms: TermDefinition[]): React.ReactNode[] {
  const found = terms
    .map((t) => ({ ...t, at: text.indexOf(t.term) }))
    .filter((t) => t.at >= 0)
    .sort((a, b) => a.at - b.at);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const t of found) {
    if (t.at < cursor) continue; // overlaps an earlier term
    parts.push(text.slice(cursor, t.at), <Term key={t.term} term={t.term} />);
    cursor = t.at + t.term.length;
  }
  parts.push(text.slice(cursor));
  return parts;
}

/**
 * A paragraph in the editor's voice. `{1}`, `{2}`… in the text mark where the cited comments'
 * words go; Cite prints the checked excerpt, so quoted words can only come from the thread.
 * Each term is marked where it first appears, and its definition is set as a note after the
 * paragraph. Terms that don't appear in the text are dropped.
 */
export function Prose({
  text,
  cites = [],
  terms = [],
}: {
  text: string;
  cites?: QuoteRef[];
  terms?: TermDefinition[];
}) {
  const used = terms.filter((t) => text.includes(t.term));
  const marked = new Set<string>();
  const parts = text.split(/(\{\d+\})/).map((part, i) => {
    const slot = part.match(/^\{(\d+)\}$/);
    if (slot) {
      const cite = cites[Number(slot[1]) - 1];
      return cite ? <Cite key={i} {...cite} /> : null;
    }
    // Mark each term once, in whichever stretch of text it first appears.
    const here = used.filter((t) => !marked.has(t.term) && part.includes(t.term));
    here.forEach((t) => marked.add(t.term));
    return <Fragment key={i}>{markTerms(part, here)}</Fragment>;
  });
  return (
    <>
      <p className={styles.prose} data-prose>
        {parts}
      </p>
      {used.map((t) => (
        <TermNote key={t.term} term={t.term}>
          {t.definition}
        </TermNote>
      ))}
    </>
  );
}

export function KeyPoints({ title, items }: { title: string; items: React.ReactNode[] }) {
  return (
    <aside className={styles.keyPoints}>
      <h3 className={styles.keyTitle}>{title}</h3>
      <ol>
        {items.map((item, i) => (
          <li key={i}>
            <span className={styles.keyNumber}>{i + 1}</span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
