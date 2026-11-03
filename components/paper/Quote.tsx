import {
  type Comment,
  type Thread,
  formatElapsed,
  getComment,
  hnItemUrl,
  hnUserUrl,
  hoursAfterPost,
  isReplyChain,
  paragraphs,
  quotedComment,
} from "@/lib/thread";
import { useThread } from "./ThreadContext";
import { HighlightTarget } from "./Highlight";
import styles from "./Quote.module.css";

export type QuoteRef = {
  id: number;
  /** An exact excerpt of the comment. Omitted or unverifiable → the full comment is shown. */
  excerpt?: string;
};

/** The words to show: the excerpt (already checked by quotedComment), or the whole comment. */
function quotedText(comment: Comment, excerpt?: string): string[] {
  return excerpt ? [excerpt] : paragraphs(comment.html);
}

function Byline({ thread, comment }: { thread: Thread; comment: Comment }) {
  const parent = getComment(thread, comment.parent);
  const isOp = comment.author === thread.story.author;
  return (
    <span className={styles.byline}>
      <a className={styles.author} href={hnUserUrl(comment.author)}>
        {comment.author}
      </a>
      {isOp && <span className={styles.op}>author</span>}
      {parent && <span className={styles.meta}>replying to {parent.author}</span>}
      <a className={styles.meta} href={hnItemUrl(comment.id)}>
        {formatElapsed(hoursAfterPost(thread, comment.time))} ↗
      </a>
    </span>
  );
}

/** A display quote. Unknown ids render nothing. */
export function PullQuote({ id, excerpt }: QuoteRef) {
  const thread = useThread();
  const comment = quotedComment(thread, id, excerpt);
  if (!comment) return null;
  return (
    // data-pull: placed between sections, the quote breaks out across the story (Paper.module.css).
    <HighlightTarget id={comment.id} className={styles.pull} data-pull>
      <figure>
        <blockquote>
          {quotedText(comment, excerpt).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </blockquote>
        <figcaption>
          <Byline thread={thread} comment={comment} />
        </figcaption>
      </figure>
    </HighlightTarget>
  );
}

/** A back-and-forth. Renders nothing unless each comment replies to the one before it. */
export function Exchange({ quotes }: { quotes: QuoteRef[] }) {
  const thread = useThread();
  if (!isReplyChain(thread, quotes.map((q) => q.id))) return null;
  return (
    // data-linear: a conversation reads top to bottom, so its section is never set in columns.
    <ol className={styles.exchange} data-linear="measure">
      {quotes.map(({ id, excerpt }) => {
        const comment = getComment(thread, id)!;
        return (
          <li key={id}>
            <HighlightTarget id={id} className={styles.turn}>
              <Byline thread={thread} comment={comment} />
              {quotedText(comment, excerpt).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </HighlightTarget>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * A commenter's words woven into the editor's paragraph: the excerpt in quotation marks, linked to
 * the comment. When the paragraph doesn't name the commenter, a small credit follows. Renders
 * nothing unless the excerpt is verbatim, so a paragraph can never put words in someone's mouth.
 */
export function Cite({ id, excerpt, paragraph = "" }: QuoteRef & { paragraph?: string }) {
  const thread = useThread();
  const comment = excerpt ? quotedComment(thread, id, excerpt) : null;
  if (!comment || !excerpt) return null;
  const named = paragraph.includes(comment.author);
  return (
    <HighlightTarget id={comment.id} inline className={styles.cite}>
      <a href={hnItemUrl(comment.id)} className={styles.citeQuote} title={`${comment.author}'s comment on Hacker News`}>
        “{excerpt}”
      </a>
      {!named && (
        <a href={hnUserUrl(comment.author)} className={styles.citeCredit}>
          {comment.author}
        </a>
      )}
    </HighlightTarget>
  );
}

/** A comment's opening, cut at a sentence end near `max` characters, for quotes given without an excerpt. */
function opening(comment: Comment, max = 220): string {
  const text = paragraphs(comment.html).join(" ");
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return stop > max / 3 ? cut.slice(0, stop + 1) : `${cut.replace(/\s+\S*$/, "")}…`;
}

/** A short attributed excerpt, used inside other components. Without an excerpt, the comment's opening. */
export function Citation({ id, excerpt }: QuoteRef) {
  const thread = useThread();
  const comment = quotedComment(thread, id, excerpt);
  if (!comment) return null;
  const text = excerpt ?? opening(comment);
  return (
    <HighlightTarget id={comment.id} className={styles.citation}>
      <p>{text}</p>
      <a href={hnUserUrl(comment.author)} className={styles.citationAuthor}>
        {comment.author}
      </a>
    </HighlightTarget>
  );
}
