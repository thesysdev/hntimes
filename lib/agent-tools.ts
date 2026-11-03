import { fetchPage } from "./exa";
import { fetchThread } from "./hn";
import type { Thread } from "./thread";

// The edition agent's sources. The route calls all of them before the model runs and puts the
// results in one prompt; the model never calls them itself.

export type Article = { url: string; title?: string | null; text: string; image: string | null };
export type EditionImage = { src: string; credit: string; shows: string };

/** Article text is cut here: enough for the substance, without crowding out the thread (~7K tokens). */
const ARTICLE_MAX_CHARACTERS = 30_000;

/** The story id in an HN item URL, or a bare id. */
export function storyIdFrom(url: string): string | null {
  return url.match(/[?&]id=(\d+)/)?.[1] ?? url.match(/^\d+$/)?.[0] ?? null;
}

/** The story and every comment in its thread, from HN's Algolia API. */
export async function fetchHnThread(url: string): Promise<{ thread: Thread; source: string } | null> {
  const id = storyIdFrom(url);
  return id ? fetchThread(id) : null;
}

/**
 * The readable text of the page a story links to (via Exa), or null when there's nothing to read:
 * paywalls, PDFs Exa can't parse, blocked pages. Errors such as a bad key are thrown.
 */
export async function fetchArticle(url: string): Promise<Article | null> {
  const page = await fetchPage(url, ARTICLE_MAX_CHARACTERS);
  return page && { url: page.url, title: page.title, text: page.text, image: page.image };
}

/** Site-wide images that say nothing about the story: logos, default share cards, favicons. */
const GENERIC_IMAGE = /(og[-_]?image|default|logo|favicon|placeholder|share[-_]?card|social[-_]?card|brand)/i;

/** Whether an article's preview image is a generic one (for lead art, which is off for now). */
export function isGenericImage(src: string): boolean {
  try {
    const { pathname } = new URL(src);
    return GENERIC_IMAGE.test(pathname.split("/").pop() ?? "") || pathname.split("/").length <= 2;
  } catch {
    return true;
  }
}

// Images for the edition: each with a src the page can load, a credit and what it shows.
// Off for now: editions are written without lead art. The real source will be OpenUI Cloud's
// standalone image search endpoint (details pending).
//
// export async function searchImages(query: string): Promise<EditionImage[]> {
//   return [];
// }
