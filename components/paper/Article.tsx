import { isVerbatim } from "@/lib/thread";
import { useThread } from "./ThreadContext";
import styles from "./Article.module.css";

/**
 * The article's address as a safe link: only http(s) URLs are linked, and one that doesn't parse
 * is left out rather than breaking the page.
 */
function articleLink(url: string): { href: string; host: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return { href: parsed.href, host: parsed.hostname.replace(/^www\./, "") };
  } catch {
    return null;
  }
}

/** What the linked source says, kept visibly separate from what commenters said. */
export function ArticleSummary({ title, points }: { title: string; points: React.ReactNode[] }) {
  const { article } = useThread();
  if (!article) return null;
  const link = articleLink(article.url);
  return (
    <aside className={styles.summary}>
      <p className={styles.label}>
        ¶ From the article{link && <> · <a href={link.href}>{link.host}</a></>}
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
  const link = articleLink(article.url);
  return (
    <blockquote className={styles.quote}>
      <p>{text}</p>
      <footer>¶ {link ? <a href={link.href}>The article</a> : "The article"}</footer>
    </blockquote>
  );
}
