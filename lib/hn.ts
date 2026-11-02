import { plainText, type Comment, type Thread } from "./thread";

// Fetches a Hacker News thread and normalizes it into a Thread.
// Source: HN's public Algolia API (free, no key), which returns the whole tree in one request.

/** One item in Algolia's tree shape. */
type RawItem = {
  type?: string;
  id: number;
  author: string | null;
  created_at_i: number;
  parent_id: number | null;
  text: string | null;
  title?: string | null;
  url?: string | null;
  points?: number | null;
  children: RawItem[];
};

const TIMEOUT_MS = 15_000;

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!response.ok) throw new Error(`${url} → ${response.status}`);
  return (await response.json()) as T;
}

function countReplies(node: RawItem): number {
  return node.children.reduce((n, c) => n + 1 + countReplies(c), 0);
}

/** Turns a raw tree into a Thread: comments in thread order, links collected, deleted ones dropped. */
export function normalize(raw: RawItem): Thread {
  const comments: Record<string, Comment> = {};
  const order: number[] = [];
  const links: Record<string, number[]> = {};

  function walk(node: RawItem, depth: number) {
    for (const child of node.children) {
      if (!child.text || !child.author) continue; // deleted or dead
      comments[child.id] = {
        id: child.id,
        author: child.author,
        time: child.created_at_i,
        parent: child.parent_id ?? raw.id,
        depth,
        replies: countReplies(child),
        html: child.text,
      };
      order.push(child.id);
      for (const [, href] of child.text.matchAll(/href="([^"]+)"/g)) {
        const url = href.replaceAll("&#x2F;", "/").replaceAll("&amp;", "&");
        (links[url] ??= []).push(child.id);
      }
      walk(child, depth + 1);
    }
  }
  walk(raw, 0);

  return {
    story: {
      id: raw.id,
      title: raw.title ?? "",
      url: raw.url ?? null,
      text: raw.text ?? null,
      author: raw.author ?? "",
      points: raw.points ?? 0,
      time: raw.created_at_i,
      commentCount: order.length,
      topLevelCount: raw.children.filter((c) => comments[c.id]).length,
    },
    article: null,
    comments,
    order,
    links,
  };
}

function fromAlgolia(id: string): Promise<RawItem> {
  return getJson<RawItem>(`https://hn.algolia.com/api/v1/items/${id}`);
}

export type FrontPageStory = {
  id: number;
  title: string;
  url: string | null;
  author: string;
  points: number;
  comments: number;
  time: number;
};

type AlgoliaHit = {
  objectID: string;
  title: string;
  url: string | null;
  author: string;
  points: number | null;
  num_comments: number | null;
  created_at_i: number;
};

/**
 * The stories on HN's front page, ranked roughly as HN ranks them (points decaying with age),
 * since Algolia doesn't return them in front-page order.
 */
export async function fetchFrontPage(): Promise<FrontPageStory[]> {
  const { hits } = await getJson<{ hits: AlgoliaHit[] }>("https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30");
  const now = Date.now() / 1000;
  const rank = (s: FrontPageStory) => (s.points - 1) / Math.pow((now - s.time) / 3600 + 2, 1.8);
  return hits
    .map((h) => ({
      id: Number(h.objectID),
      title: h.title,
      url: h.url,
      author: h.author,
      points: h.points ?? 0,
      comments: h.num_comments ?? 0,
      time: h.created_at_i,
    }))
    .sort((a, b) => rank(b) - rank(a));
}

/** The thread for an HN story id, from Algolia. Throws for anything that isn't a story. */
export async function fetchThread(id: string): Promise<{ thread: Thread; source: "algolia" }> {
  const raw = await fromAlgolia(id);
  // Comments, jobs and polls have item ids too: only stories (including Ask and Show HN) have editions.
  if (raw.type !== "story" || raw.id !== Number(id)) throw new Error(`Item ${id} isn't a Hacker News story.`);
  return { thread: normalize(raw), source: "algolia" };
}

export type EarlierStory = { id: number; title: string; points: number; comments: number; time: number };

/**
 * Hosts shared by unrelated projects, where "earlier stories from this site" would mean nothing;
 * for these the search narrows to the first path segment (github.com/<owner>).
 */
const SHARED_HOSTS = new Set(["github.com", "gitlab.com", "codeberg.org", "medium.com", "substack.com", "dev.to"]);
/** Hosts so broad that even narrowed they say nothing about the story. */
const SKIPPED_HOSTS = new Set(["youtube.com", "youtu.be", "twitter.com", "x.com", "arxiv.org", "en.wikipedia.org", "news.ycombinator.com"]);

/**
 * Earlier HN stories from the same site (or the same GitHub owner), most discussed first, so the
 * edition can say what readers have said about it before. Empty for text posts and broad hosts.
 */
export async function fetchEarlierStories(story: Thread["story"]): Promise<EarlierStory[]> {
  if (!story.url) return [];
  const url = new URL(story.url);
  const host = url.hostname.replace(/^www\./, "");
  if (SKIPPED_HOSTS.has(host)) return [];
  const owner = url.pathname.split("/")[1];
  const site = SHARED_HOSTS.has(host) ? (owner ? `${host}/${owner}` : null) : host;
  if (!site) return [];

  const query = new URLSearchParams({
    query: site,
    restrictSearchableAttributes: "url",
    tags: "story",
    numericFilters: "num_comments>=20",
    hitsPerPage: "20",
  });
  const { hits } = await getJson<{ hits: AlgoliaHit[] }>(`https://hn.algolia.com/api/v1/search?${query}`);
  return hits
    .filter((h) => Number(h.objectID) !== story.id && h.url?.includes(site))
    .map((h) => ({
      id: Number(h.objectID),
      title: h.title,
      points: h.points ?? 0,
      comments: h.num_comments ?? 0,
      time: h.created_at_i,
    }))
    .sort((a, b) => b.comments - a.comments)
    .slice(0, 5);
}

export type Profile = { karma: number; about: string };

/** How much of a profile's "about" the edition sees: enough for a job title or a project. */
const ABOUT_CHARS = 240;

/**
 * A commenter's HN profile (karma and what they say about themselves), or null if it can't be
 * read. Contact details are cut from the about text: the edition only needs a person's standing.
 */
export async function fetchProfile(name: string): Promise<Profile | null> {
  try {
    const user = await getJson<{ karma?: number; about?: string | null }>(
      `https://hn.algolia.com/api/v1/users/${encodeURIComponent(name)}`,
    );
    const about = plainText(user.about ?? "")
      .replace(/\S+@\S+/g, "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return { karma: user.karma ?? 0, about: about.length > ABOUT_CHARS ? `${about.slice(0, ABOUT_CHARS)}…` : about };
  } catch {
    return null;
  }
}

/** Profiles for several commenters at once, by username; ones that can't be read are left out. */
export async function fetchProfiles(names: string[]): Promise<Record<string, Profile>> {
  const profiles = await Promise.all(names.map(async (name) => [name, await fetchProfile(name)] as const));
  return Object.fromEntries(profiles.filter((entry): entry is [string, Profile] => entry[1] !== null));
}

export type Story = {
  id: number;
  time: number;
  points: number;
  comments: number;
  title: string;
  url: string | null;
  author: string;
};

/**
 * A story's headline facts, from a light Algolia lookup (not the whole thread). Null when the id
 * isn't a story: a comment, job, poll, or nothing at all. Ask HN and Show HN posts are stories.
 */
export async function fetchStory(id: number): Promise<Story | null> {
  const query = new URLSearchParams({ tags: `story,story_${id}`, hitsPerPage: "1" });
  const { hits } = await getJson<{ hits: AlgoliaHit[] }>(`https://hn.algolia.com/api/v1/search?${query}`);
  const hit = hits.find((h) => Number(h.objectID) === id);
  if (!hit) return null;
  return {
    id,
    time: hit.created_at_i,
    points: hit.points ?? 0,
    comments: hit.num_comments ?? 0,
    title: hit.title,
    url: hit.url,
    author: hit.author,
  };
}
