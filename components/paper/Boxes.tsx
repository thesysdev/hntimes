import { getComment, hnItemUrl, hnUserUrl, quotedComment } from "@/lib/thread";
import { HighlightTarget } from "./Highlight";
import type { QuoteRef } from "./Quote";
import { useThread } from "./ThreadContext";
import styles from "./Boxes.module.css";
import { LinkNames } from "./Handle";

// Boxes that break up the columns of text: figures, a chronology, the people in the story.
// An entry tied to a comment credits its author, unless the entry's own text already names them.

type Fact = {
  value: string;
  label: string;
  /** The comment the figure comes from; omitted for figures from the article. */
  id?: number;
};

/** "By the numbers": a few large figures with what each one counts. */
export function FactBox({ title, facts }: { title: string; facts: Fact[] }) {
  const thread = useThread();
  // A figure credited to a comment that isn't in the thread is dropped.
  const shown = facts.filter((f) => f.id === undefined || getComment(thread, f.id));
  if (shown.length === 0) return null;
  return (
    // data-box: placed between sections, it breaks out across the story (Paper.module.css).
    <aside className={styles.facts} data-box>
      <h3 className={styles.boxTitle}>{title}</h3>
      <dl>
        {shown.map((fact, i) => (
          <div key={i} className={styles.fact}>
            <dt className={styles.value}>{fact.value}</dt>
            <dd className={styles.label}>
              <LinkNames text={fact.label} />
              {fact.id !== undefined && !fact.label.includes(getComment(thread, fact.id)!.author) && (
                <a href={hnItemUrl(fact.id)} className={styles.source}>
                  {getComment(thread, fact.id)!.author}
                </a>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

type Event = {
  when: string;
  what: string;
  id?: number;
};

/** A chronology: what happened when, each entry optionally tied to the comment that reports it. */
export function Timeline({ title, events }: { title: string; events: Event[] }) {
  const thread = useThread();
  const shown = events.filter((e) => e.id === undefined || getComment(thread, e.id));
  if (shown.length === 0) return null;
  return (
    // data-linear: a chronology reads top to bottom, so its section is never set in columns.
    <section className={styles.timeline} data-linear="measure">
      <h3 className={styles.boxTitle}>{title}</h3>
      <ol>
        {shown.map((event, i) => (
          <li key={i} className={styles.event}>
            <span className={styles.when}>{event.when}</span>
            <span className={styles.what}>
              <LinkNames text={event.what} />
              {event.id !== undefined && !event.what.includes(getComment(thread, event.id)!.author) && (
                <a href={hnItemUrl(event.id)} className={styles.source}>
                  {getComment(thread, event.id)!.author}
                </a>
              )}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** "Who's talking": the people the story is told through, named from the thread itself. */
export function Cast({ title, people }: { title: string; people: { id: number; who: string }[] }) {
  const thread = useThread();
  // One entry per person, and only people who are in the thread.
  const seen = new Set<string>();
  const shown = people.flatMap(({ id, who }) => {
    const comment = getComment(thread, id);
    if (!comment || seen.has(comment.author)) return [];
    seen.add(comment.author);
    const karma = thread.people?.[comment.author]?.karma;
    return [{ id, who, karma, author: comment.author, isOp: comment.author === thread.story.author }];
  });
  if (shown.length === 0) return null;
  return (
    <aside className={styles.cast}>
      <h3 className={styles.boxTitle}>{title}</h3>
      <ul>
        {shown.map((person) => (
          <li key={person.id}>
            <HighlightTarget id={person.id} className={styles.person}>
              <a href={hnUserUrl(person.author)} className={styles.name}>
                {person.author}
              </a>
              {person.isOp && <span className={styles.op}>poster</span>}
              {person.karma !== undefined && (
                <span className={styles.karma}>{compact.format(person.karma)} karma</span>
              )}
              <span className={styles.who}>
                <LinkNames text={person.who} />{" "}
                <a href={hnItemUrl(person.id)} className={styles.source}>
                  comment ↗
                </a>
              </span>
            </HighlightTarget>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** Excerpts that check out against their comments, with each comment. Others are dropped. */
function useVerified(quotes: QuoteRef[]) {
  const thread = useThread();
  return quotes.flatMap((q) => {
    const comment = q.excerpt ? quotedComment(thread, q.id, q.excerpt) : null;
    return comment && q.excerpt ? [{ id: comment.id, excerpt: q.excerpt, comment }] : [];
  });
}

/**
 * A vox pop: the question readers were answering, then their short answers side by side, each
 * signed directly beneath.
 */
export function VoxPop({ title, quotes }: { title: string; quotes: QuoteRef[] }) {
  const shown = useVerified(quotes).slice(0, 4);
  if (shown.length < 2) return null;
  return (
    // data-box: placed between sections, it breaks out across the story (Paper.module.css).
    <aside className={styles.vox} data-box>
      <p className={styles.voxLabel}>Readers respond</p>
      <h3 className={styles.voxQuestion}>
        <LinkNames text={title} />
      </h3>
      <ul style={{ "--voices": shown.length } as React.CSSProperties}>
        {shown.map(({ id, excerpt, comment }, i) => (
          <li key={`${id}-${i}`}>
            <HighlightTarget id={id} className={styles.voice}>
              <a href={hnItemUrl(id)} className={styles.voiceQuote}>
                <span className={styles.voiceMark} aria-hidden>
                  “
                </span>
                {excerpt}”
              </a>
              <a href={hnUserUrl(comment.author)} className={styles.voiceName}>
                {comment.author}
              </a>
            </HighlightTarget>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** "For the record": a claim, and the reader who corrected it, in their own words. */
export function Correction({ claim, quote }: { claim: string; quote: QuoteRef }) {
  const [fix] = useVerified([quote]);
  if (!fix) return null;
  return (
    <aside className={styles.correction} data-box>
      <h3 className={styles.boxTitle}>For the record</h3>
      <p className={styles.claim}>
        <span className={styles.claimLabel}>The claim</span>
        {/* Struck through on its own span: a decoration on the paragraph would strike the label too. */}
        <span className={styles.claimText}>
          <LinkNames text={claim} />
        </span>
      </p>
      <HighlightTarget id={fix.id} className={styles.fix}>
        <span className={styles.claimLabel}>
          The correction, from{" "}
          <a href={hnUserUrl(fix.comment.author)} className={styles.name}>
            {fix.comment.author}
          </a>
        </span>
        <a href={hnItemUrl(fix.id)} className={styles.fixQuote}>
          “{fix.excerpt}”
        </a>
      </HighlightTarget>
    </aside>
  );
}
