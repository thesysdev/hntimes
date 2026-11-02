import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LiveEdition, Masthead, PaperFrame } from "@/components/paper";
import { StillBuilding, TooQuiet } from "@/components/paper/Dispatch";
import { caching, decide, loadEdition, loadEditionRecord } from "@/lib/cache";
import { fetchStory } from "@/lib/hn";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * A story's edition, at the same path as on HN: swap news.ycombinator.com for this site in any
 * item URL. The edition is written when the page opens.
 */
export default function Item({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PaperFrame masthead={<Masthead />}>{null}</PaperFrame>}>
      <Edition searchParams={searchParams} />
    </Suspense>
  );
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
  const record = await loadEditionRecord(Number(id));
  const story = record?.frozen ? null : await fetchStory(Number(id)).catch(() => null);
  const decision = decide(record, story);
  if (!decision) notFound();
  if (decision.action === "serve") {
    const doc = await loadEdition(decision.record);
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
