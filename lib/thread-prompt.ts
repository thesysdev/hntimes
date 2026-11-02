import type { Article, EditionImage } from "./agent-tools";
import type { EditorNotes } from "./editor";
import type { EarlierStory } from "./hn";
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

/** The assignment editor's brief, as the writer reads it. */
function formatNotes(notes: EditorNotes, poster: string, people: Thread["people"] = {}): string[] {
  const profile = (name: string) => {
    const p = people[name];
    if (!p) return "";
    return ` (HN karma ${p.karma.toLocaleString("en-US")}${p.about ? `; profile says: "${p.about}"` : ""})`;
  };
  return [
    ...(poster ? [`Poster: ${poster}${profile(poster)}`] : []),
    `Shape: ${notes.shape}`,
    `Angle: ${notes.angle}`,
    `Working headline: ${notes.headline}`,
    "Cast (quote the story through these people; [id] is one of their comments):",
    ...(notes.cast.length ? notes.cast.map((p) => `- ${p.author} [${p.id}]: ${p.who}${profile(p.author)}`) : ["- None picked."]),
    "Moments to build on:",
    ...(notes.moments.length ? notes.moments.map((m) => `- [${m.id}] ${m.why}`) : ["- None picked."]),
  ];
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
  notes: EditorNotes,
  earlier: EarlierStory[],
): string {
  return [
    "# Editor's notes",
    ...formatNotes(notes, thread.story.author, thread.people),
    "",
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
    "",
    "# Earlier on Hacker News from the same site",
    "Background only: you may mention these in Prose (year, title, how big the discussion was), but there are no comments from them to quote.",
    ...formatEarlier(earlier),
  ].join("\n");
}
