import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LiveEdition, Masthead, PaperFrame } from "@/components/paper";
import { StillBuilding, TooQuiet } from "@/components/paper/Dispatch";
import { caching, decide } from "@/lib/cache";
import { cover, edition, editionRecord, story as fetchStory } from "@/lib/cover";
import { SITE } from "@/lib/site";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The edition's headline and dek as its title and description, with its own share image. */
export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  // Written per request, from the story and its stored edition.
  await connection();
  const { id } = await searchParams;
  if (typeof id !== "string" || !/^\d+$/.test(id)) return { robots: { index: false } };
  const found = await cover(Number(id));
  if (!found) return { title: "Story not found", robots: { index: false } };
  const url = `/item?id=${id}`;
  const description = found.dek ?? `How Hacker News readers discussed “${found.story?.title ?? found.title}”.`;
  const image = { url: `/api/og/${id}`, width: 1200, height: 630, alt: found.title };
  return {
    title: found.title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "article", siteName: SITE.name, url, title: found.title, description, images: [image] },
    twitter: { card: "summary_large_image", title: found.title, description, images: [image] },
  };
}

/**
 * A story's edition, at the same path as on HN: swap news.ycombinator.com for this site in any
 * item URL. The edition is written when the page opens.
 */
export default function Item({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <Suspense fallback={<PaperFrame masthead={<Masthead />}>{null}</PaperFrame>}>
        <Edition searchParams={searchParams} />
      </Suspense>
      {/* The metadata reads the request (see generateMetadata): this tells Next.js that's intended. */}
      <Suspense>
        <Connection />
      </Suspense>
    </>
  );
}

async function Connection() {
  await connection();
  return null;
}

async function Edition({ searchParams }: { searchParams: SearchParams }) {
  const { id, replay } = await searchParams;
  if (typeof id !== "string" || !/^\d+$/.test(id)) notFound();
  // Keyed by story, so moving between items starts a fresh edition. ?replay (development only)
  // shows the latest saved run instead of writing a new one.
  const replaying = process.env.NODE_ENV === "development" && replay !== undefined;
  if (!caching) return <LiveEdition key={id} storyId={id} replay={replaying} />;

  // Production: the caching rules (lib/cache.ts) pick between a cached edition, rendered here at
  // once, a "still building" page, and a new edition, which the page writes (or joins) on load.
  const record = await editionRecord(Number(id));
  const story = record?.frozen ? null : await fetchStory(Number(id));
  const decision = decide(record, story);
  if (!decision) notFound();
  if (decision.action === "serve") {
    const doc = await edition(decision.record);
    if (doc) return <LiveEdition key={id} storyId={id} initial={{ program: doc.program, thread: doc.thread }} />;
  }
  if (decision.action === "building")
    return (
      <PaperFrame masthead={<Masthead edition={Number(id)} />}>
        <StillBuilding title={decision.story.title} readyIn={decision.readyIn} />
      </PaperFrame>
    );
  if (decision.action === "quiet")
    return (
      <PaperFrame masthead={<Masthead edition={Number(id)} />}>
        <TooQuiet title={decision.story.title} settled={decision.settled} />
      </PaperFrame>
    );
  return <LiveEdition key={id} storyId={id} />;
}
