import type { Comment, Thread } from "./thread";

// Fetches a Hacker News thread and normalizes it into a Thread.
// Source: HN's public Algolia API (free, no key), which returns the whole tree in one request.

/** One item in Algolia's tree shape. */
type RawItem = {
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

/** The thread for an HN story id, from Algolia. */
export async function fetchThread(id: string): Promise<{ thread: Thread; source: "algolia" }> {
  return { thread: normalize(await fromAlgolia(id)), source: "algolia" };
}
