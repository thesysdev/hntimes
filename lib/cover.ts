import { cache } from "react";
import { caching, loadEdition, loadEditionRecord } from "./cache";
import { fetchStory, type Story } from "./hn";

// What an edition is called, for its metadata and share image: the edition's own headline when one
// is stored, otherwise the HN story's title. The loaders are memoized per request, so the page and
// its metadata read the cache once.

export const editionRecord = cache(loadEditionRecord);
export const edition = cache(loadEdition);
export const story = cache(async (id: number) => fetchStory(id).catch(() => null));

export type Cover = {
  story: Story | null;
  /** Whether the cover is the stored edition's own headline, not the HN title standing in for it. */
  fromEdition: boolean;
  kicker: string | null;
  title: string;
  dek: string | null;
};

/** The kicker, title and dek of an edition's `headline = Headline(...)` line, if it parses. */
export function headlineOf(program: string): { kicker: string; title: string; dek: string } | null {
  const string = String.raw`"(?:[^"\\]|\\.)*"`;
  const match = program.match(new RegExp(String.raw`^headline\s*=\s*Headline\((${string}),\s*(${string}),\s*(${string})`, "m"));
  if (!match) return null;
  try {
    const [kicker, title, dek] = match.slice(1).map((s) => JSON.parse(s) as string);
    return { kicker, title, dek };
  } catch {
    return null;
  }
}

/** An edition's cover, or null when the id is no HN story. */
export const cover = cache(async (id: number): Promise<Cover | null> => {
  const [found, record] = await Promise.all([story(id), caching ? editionRecord(id) : null]);
  const doc = record && (await edition(record));
  const headline = doc && headlineOf(doc.program);
  if (headline) return { story: found, fromEdition: true, ...headline };
  if (!found) return null;
  return { story: found, fromEdition: false, kicker: null, title: found.title, dek: null };
});
