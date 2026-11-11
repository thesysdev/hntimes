import { getComment, hnItemUrl } from "@/lib/thread";
import { useThread } from "./ThreadContext";
import styles from "./Closing.module.css";
import { LinkNames, withoutAt } from "./Handle";

/** Questions the thread raised and didn't settle, each tied to the comment that raised it. */
export function OpenQuestions({ items }: { items: { question: string; commentId: number }[] }) {
  const thread = useThread();
  const valid = items.filter((q) => getComment(thread, q.commentId));
  if (valid.length === 0) return null;
  return (
    <ul className={styles.questions}>
      {valid.map(({ question, commentId }, i) => (
        <li key={`${commentId}-${i}`}>
          <span className={styles.question}>
            <LinkNames text={question} />
          </span>{" "}
          <a href={hnItemUrl(commentId)} className={styles.raisedBy}>
            raised by {getComment(thread, commentId)!.author}
          </a>
        </li>
      ))}
    </ul>
  );
}

type Resource = {
  name: string;
  note: string;
  /** Must be a link that appears in the thread. */
  url?: string;
  /** For things named without a link: the comments that mention it. */
  commentIds?: number[];
};

/** Everything worth following up, grouped. Links not found in the thread are dropped. */
export function ReadingList({ groups }: { groups: { title: string; items: Resource[] }[] }) {
  const thread = useThread();
  return (
    <div className={styles.reading}>
      {groups.map((group) => {
        const items = group.items
          .map((item) => {
            const found = item.url ? thread.links[item.url] : item.commentIds?.filter((id) => getComment(thread, id));
            // One credit per person, linking to their first mention.
            const credits = found?.filter(
              (id, i) => found.findIndex((other) => getComment(thread, other)!.author === getComment(thread, id)!.author) === i,
            );
            return credits?.length ? { ...item, credits } : null;
          })
          .filter((item) => item !== null);
        if (items.length === 0) return null;
        return (
          <section key={group.title} className={styles.group}>
            <h3 className={styles.groupTitle}>
              <LinkNames text={group.title} />
            </h3>
            <ul>
              {items.map((item) => (
                <li key={item.name} className={styles.item}>
                  <span className={styles.name}>
                    {item.url ? <a href={item.url}>{withoutAt(item.name)}</a> : <LinkNames text={item.name} />}
                  </span>
                  <span className={styles.note}>
                    <LinkNames text={item.note} />
                  </span>
                  <span className={styles.mentions}>
                    {item.credits.map((id, i) => (
                      <a key={id} href={hnItemUrl(id)}>
                        {i === 0 ? "" : ", "}
                        {getComment(thread, id)!.author}
                      </a>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function Colophon() {
  const { story, article } = useThread();
  return (
    <footer className={styles.colophon}>
      <p>
        Composed from {story.commentCount} comments{article ? " and the linked article" : ""}, and set live
        with{" "}
        <a href="https://www.openui.com" className={styles.openui}>
          OpenUI
        </a>
        . Quotes are verbatim and link to their source on Hacker News; notes marked ◆ are added context.
        Here&rsquo;s <a href="/about">how it works</a>.
      </p>
    </footer>
  );
}
