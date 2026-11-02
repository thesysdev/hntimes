import type { Article, EditionImage } from "./agent-tools";
import { getComment, hoursAfterPost, plainText, type Thread } from "./thread";

/**
 * A thread as the model reads it: the story, every comment (with the ids it must cite), and the
 * links it may list. Compact text rather than JSON, since a large thread runs to ~50K tokens.
 */
export function formatThread(thread: Thread): string {
  const { story } = thread;
  const lines: string[] = [
    `# Story ${story.id}`,
    `Title: ${story.title}`,
    `Posted by ${story.author} on ${new Date(story.time * 1000).toISOString().slice(0, 10)}`,
    `${story.points} points, ${story.commentCount} comments, ${story.topLevelCount} top-level`,
    story.url ? `Link: ${story.url}` : "Link: none (a text post)",
    ...(story.text ? ["", "# Post text", plainText(story.text)] : []),
    "",
    "# Comments",
    "Each comment: [id] author · replying to (story or author [id]) · depth · hours after the post. Text follows.",
    "",
  ];

  for (const id of thread.order) {
    const c = thread.comments[id];
    const parent = getComment(thread, c.parent);
    const to = parent ? `${parent.author} [${parent.id}]` : "story";
    const hours = hoursAfterPost(thread, c.time).toFixed(1);
    lines.push(`[${c.id}] ${c.author} · replying to ${to} · depth ${c.depth} · ${hours}h`);
    lines.push(plainText(c.html).replace(/\n\n/g, " ¶ "));
    lines.push("");
  }

  lines.push("# Links in the thread", "Each: url · ids of the comments that mention it.");
  for (const [url, ids] of Object.entries(thread.links)) lines.push(`${url} · ${ids.join(", ")}`);
  return lines.join("\n");
}

/** Everything the agent gathered for one story, as a single prompt. */
export function editionPrompt(thread: Thread, article: Article | null, images: EditionImage[]): string {
  return [
    formatThread(thread),
    "",
    "# Article",
    article
      ? [article.title ? `Title: ${article.title}` : "", article.text].filter(Boolean).join("\n\n")
      : "Not available. Do not use ArticleSummary or ArticleQuote.",
    "",
    "# Images",
    "Each: src · credit · what it shows.",
    ...(images.length ? images.map((i) => `${i.src} · credit: ${i.credit} · shows: ${i.shows}`) : ["None."]),
  ].join("\n");
}
