import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LiveEdition, Masthead, PaperFrame } from "@/components/paper";

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
  return <LiveEdition key={id} storyId={id} replay={replaying} />;
}
