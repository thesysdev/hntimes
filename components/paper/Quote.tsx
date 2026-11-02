import {
  type Comment,
  type Thread,
  formatElapsed,
  getComment,
  hnItemUrl,
  hoursAfterPost,
  isReplyChain,
  isVerbatim,
  paragraphs,
  plainText,
} from "@/lib/thread";
import { useThread } from "./ThreadContext";
import { HighlightTarget } from "./Highlight";
import styles from "./Quote.module.css";

export type QuoteRef = {
  id: number;
  /** An exact excerpt of the comment. Omitted or unverifiable → the full comment is shown. */
  excerpt?: string;
};

/** The words to show for a comment: the excerpt if it's verbatim, otherwise the whole comment. */
function quotedText(comment: Comment, excerpt?: string): string[] {
  if (excerpt && isVerbatim(plainText(comment.html), excerpt)) return [excerpt];
  return paragraphs(comment.html);
}

function Byline({ thread, comment }: { thread: Thread; comment: Comment }) {
  const parent = getComment(thread, comment.parent);
  const isOp = comment.author === thread.story.author;
  return (
    <span className={styles.byline}>
      <span className={styles.author}>{comment.author}</span>
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
  const comment = getComment(thread, id);
  if (!comment) return null;
  return (
    <HighlightTarget id={id} className={styles.pull}>
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
 * A commenter's words woven into the editor's paragraph: the excerpt in quotation marks with a
 * small credit linking to the comment. Renders nothing unless the excerpt is verbatim, so a
 * paragraph can never put words in someone's mouth.
 */
export function Cite({ id, excerpt }: QuoteRef) {
  const thread = useThread();
  const comment = getComment(thread, id);
  if (!comment || !excerpt || !isVerbatim(plainText(comment.html), excerpt)) return null;
  return (
    <HighlightTarget id={id} inline className={styles.cite}>
      “{excerpt}”
      <a href={hnItemUrl(id)} className={styles.citeCredit}>
        {comment.author}
      </a>
    </HighlightTarget>
  );
}

/** A short attributed excerpt, used inside other components. */
export function Citation({ id, excerpt }: QuoteRef) {
  const thread = useThread();
  const comment = getComment(thread, id);
  if (!comment) return null;
  return (
    <HighlightTarget id={id} className={styles.citation}>
      <p>{quotedText(comment, excerpt).join(" ")}</p>
      <a href={hnItemUrl(id)} className={styles.citationAuthor}>
        {comment.author}
      </a>
    </HighlightTarget>
  );
}
