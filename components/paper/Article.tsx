import { isVerbatim } from "@/lib/thread";
import { useThread } from "./ThreadContext";
import styles from "./Article.module.css";

/** What the linked source says, kept visibly separate from what commenters said. */
export function ArticleSummary({ title, points }: { title: string; points: React.ReactNode[] }) {
  const { article } = useThread();
  if (!article) return null;
  return (
    <aside className={styles.summary}>
      <p className={styles.label}>
        ¶ From the article · <a href={article.url}>{new URL(article.url).hostname}</a>
      </p>
      <h3 className={styles.title}>{title}</h3>
      <ul>
        {points.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    </aside>
  );
}

/** A quote from the article. Renders nothing unless it appears verbatim in the fetched text. */
export function ArticleQuote({ text }: { text: string }) {
  const { article } = useThread();
  if (!article || !isVerbatim(article.text, text)) return null;
  return (
    <blockquote className={styles.quote}>
      <p>{text}</p>
      <footer>
        ¶ <a href={article.url}>The article</a>
      </footer>
    </blockquote>
  );
}
