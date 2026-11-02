import styles from "./Sidenote.module.css";

type Voice = "context" | "article";

const LABELS: Record<Voice, string> = {
  context: "Note",
  article: "From the article",
};

/**
 * A note set into the text. `context` is anything the editor added that isn't in the thread or
 * article; `article` is material from the linked source.
 */
export function Sidenote({
  voice = "context",
  label,
  children,
}: {
  voice?: Voice;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <aside className={styles.sidenote} data-voice={voice}>
      <span className={styles.label}>{label ?? LABELS[voice]}</span>
      <span className={styles.body}>{children}</span>
    </aside>
  );
}

/**
 * A glossary term, marked inline. Its definition is added context: Prose sets it as a note
 * after the paragraph, so it never interrupts a sentence.
 */
export function Term({ term }: { term: string }) {
  return <span className={styles.term}>{term}</span>;
}

/** The note for a Term, as Prose places it after the paragraph. */
export function TermNote({ term, children }: { term: string; children: React.ReactNode }) {
  return <Sidenote label={term}>{children}</Sidenote>;
}
