import { Fragment } from "react";
import { LinkNames } from "./Handle";
import { Cite, type QuoteRef } from "./Quote";
import { Term, TermNote } from "./Sidenote";
import styles from "./Section.module.css";

/** A titled part of the page. In the story its body is set in columns; in the sidebar it isn't. */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.title}>
        <LinkNames text={title} />
      </h2>
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
    parts.push(<LinkNames key={`text-${cursor}`} text={text.slice(cursor, t.at)} />, <Term key={t.term} term={t.term} />);
    cursor = t.at + t.term.length;
  }
  parts.push(<LinkNames key="rest" text={text.slice(cursor)} />);
  return parts;
}

/**
 * Fills the `{1}`, `{2}`… slots in a paragraph with the cited excerpts, passing the stretches of
 * text in between to `renderText` (by default: link the quoted people's usernames).
 */
export function weave(
  text: string,
  cites: QuoteRef[],
  renderText: (part: string, key: number) => React.ReactNode = (part, key) => <LinkNames key={key} text={part} />,
): React.ReactNode[] {
  const parts = text.split(/(\{\d+\})/);
  return parts.map((part, i) => {
    const slot = part.match(/^\{(\d+)\}$/);
    if (!slot) {
      // An excerpt that ends a sentence brings its own stop: drop the one typed after the slot.
      const before = parts[i - 1]?.match(/^\{(\d+)\}$/);
      const excerpt = before ? cites[Number(before[1]) - 1]?.excerpt : undefined;
      const text = excerpt && /[.!?]$/.test(excerpt.trim()) ? part.replace(/^[.,]/, "") : part;
      return renderText(text, i);
    }
    const cite = cites[Number(slot[1]) - 1];
    return cite ? <Cite key={i} {...cite} paragraph={text} /> : null;
  });
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
  const parts = weave(text, cites, (part, i) => {
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
          <LinkNames text={t.definition} />
        </TermNote>
      ))}
    </>
  );
}

export function KeyPoints({ title, items }: { title: string; items: string[] }) {
  return (
    <aside className={styles.keyPoints}>
      <h3 className={styles.keyTitle}>
        <LinkNames text={title} />
      </h3>
      <ol>
        {items.map((item, i) => (
          <li key={i}>
            <span className={styles.keyNumber}>{i + 1}</span>
            <span>
              <LinkNames text={item} />
            </span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
