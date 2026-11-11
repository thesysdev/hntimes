import type { Article, EditionImage } from "./agent-tools";
import type { EarlierStory } from "./hn";
import { getComment, hoursAfterPost, plainText, type Thread } from "./thread";

// Ceilings on what goes into a prompt. HN threads run to thousands of comments; without these a
// single story could cost hundreds of thousands of input tokens, or overflow the model's context.
/** A comment longer than this is cut (its opening stays verbatim, so it can still be quoted). */
export const MAX_COMMENT_CHARS = 2_500;
/** The writer reads at most this much of the comments (about 30K tokens). */
export const MAX_COMMENTS_CHARS = 120_000;
/** The post's own text (Ask HN, Show HN) is cut here. */
const MAX_POST_CHARS = 5_000;
/** At most this many of the thread's links are listed. */
const MAX_LINKS = 150;
/** A hard stop: no edition prompt goes out longer than this, whatever its parts. */
export const MAX_PROMPT_CHARS = 200_000;

const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

/**
 * The comments to show when a thread is over budget: the busiest conversations from the top down,
 * across the whole thread, until `budget` characters are used; returned in thread order. Comments
 * are taken by how many replies they drew in all. A reply always drew fewer than its parent, so
 * a parent is always considered first, and a reply is kept only if its parent was: the result is
 * the tops of the liveliest discussions, not one discussion in full. Each comment is counted at its
 * cut length. Under budget, that's every comment.
 */
export function selectComments(thread: Thread, budget: number, perComment = MAX_COMMENT_CHARS): number[] {
  const size = (id: number) => Math.min(plainText(thread.comments[id].html).length, perComment) + 80;
  const total = thread.order.reduce((n, id) => n + size(id), 0);
  if (total <= budget) return thread.order;

  const ranked = [...thread.order].sort((a, b) => thread.comments[b].replies - thread.comments[a].replies);
  const chosen = new Set<number>();
  let used = 0;
  for (const id of ranked) {
    const comment = thread.comments[id];
    if (comment.depth > 0 && !chosen.has(comment.parent)) continue; // its parent didn't make it
    const cost = size(id);
    if (used + cost > budget) continue; // too long for what's left; shorter ones may still fit
    chosen.add(id);
    used += cost;
  }
  return thread.order.filter((id) => chosen.has(id));
}

/**
 * A thread as the model reads it: the story, the comments (with the ids it must cite), and the
 * links it may list. Compact text rather than JSON. Large threads are cut to the ceilings above.
 */
export function formatThread(thread: Thread): string {
  const { story } = thread;
  const lines: string[] = [
    `# Story ${story.id}`,
    `Title: ${story.title}`,
    `Posted by ${story.author} on ${new Date(story.time * 1000).toISOString().slice(0, 10)}`,
    `${story.points} points, ${story.commentCount} comments, ${story.topLevelCount} top-level`,
    story.url ? `Link: ${story.url}` : "Link: none (a text post)",
    ...(story.text ? ["", "# Post text", cut(plainText(story.text), MAX_POST_CHARS)] : []),
    "",
    "# Comments",
  ];
  const shown = selectComments(thread, MAX_COMMENTS_CHARS);
  if (shown.length < thread.order.length)
    lines.push(
      `This thread is long: ${shown.length} of its ${thread.order.length} comments are shown, the busiest conversations from the top down. Quote only comments shown here.`,
    );
  lines.push(
    "Each comment: [id] author · replying to (story or author [id]) · depth · hours after the post. Text follows.",
    "",
  );

  for (const id of shown) {
    const c = thread.comments[id];
    const parent = getComment(thread, c.parent);
    const to = parent ? `${parent.author} [${parent.id}]` : "story";
    const hours = hoursAfterPost(thread, c.time).toFixed(1);
    lines.push(`[${c.id}] ${c.author} · replying to ${to} · depth ${c.depth} · ${hours}h`);
    lines.push(cut(plainText(c.html), MAX_COMMENT_CHARS).replace(/\n\n/g, " ¶ "));
    lines.push("");
  }

  // Only links from the comments shown, and only so many of them.
  const visible = new Set(shown);
  const links = Object.entries(thread.links)
    .map(([url, ids]) => [url, ids.filter((id) => visible.has(id))] as const)
    .filter(([, ids]) => ids.length > 0)
    .slice(0, MAX_LINKS);
  lines.push("# Links in the thread", "Each: url · ids of the comments that mention it.");
  for (const [url, ids] of links) lines.push(`${url} · ${ids.join(", ")}`);
  return lines.join("\n");
}

/** The HN profiles of the poster and the most-replied commenters, as the writer reads them. */
function formatPeople(thread: Thread): string[] {
  const people = Object.entries(thread.people ?? {});
  if (!people.length) return ["None found."];
  return people.map(
    ([name, p]) =>
      `- ${name}${name === thread.story.author ? " (the poster)" : ""}: HN karma ${p.karma.toLocaleString("en-US")}${p.about ? `; profile says: "${p.about}"` : ""}`,
  );
}

function formatEarlier(stories: EarlierStory[]): string[] {
  if (!stories.length) return ["None found."];
  return stories.map(
    (s) =>
      `- ${new Date(s.time * 1000).toISOString().slice(0, 7)} · "${s.title}" · ${s.points} points, ${s.comments} comments`,
  );
}

/** Everything the agent gathered for one story, as a single prompt. */
export function editionPrompt(
  thread: Thread,
  article: Article | null,
  images: EditionImage[],
  earlier: EarlierStory[],
): string {
  const prompt = [
    formatThread(thread),
    "",
    "# Article",
    article
      ? [article.title ? `Title: ${article.title}` : "", article.text].filter(Boolean).join("\n\n")
      : "Not available. Do not use ArticleSummary or ArticleQuote.",
    ...(images.length
      ? ["", "# Images", "Each: src · credit · what it shows.", ...images.map((i) => `${i.src} · credit: ${i.credit} · shows: ${i.shows}`)]
      : []),
    "",
    "# People",
    "HN profiles of the poster and of the commenters whose comments drew the most replies.",
    ...formatPeople(thread),
    "",
    "# Earlier on Hacker News from the same site",
    "Background only: you may mention these in Prose (year, title, how big the discussion was), but there are no comments from them to quote.",
    ...formatEarlier(earlier),
  ].join("\n");
  if (prompt.length > MAX_PROMPT_CHARS)
    throw new Error(`The sources for this story are too large (${prompt.length} characters; the limit is ${MAX_PROMPT_CHARS}).`);
  return prompt;
}
