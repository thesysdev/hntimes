import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { FrontPage, FrontPageSkeleton, LeadConversation, Masthead, PaperFrame } from "@/components/paper";
import { cachedFor, coverable, FRONT_PAGE_TTL, keys } from "@/lib/cache";
import { fetchFrontPage, fetchThread } from "@/lib/hn";
import { plainText } from "@/lib/thread";
import { SITE } from "@/lib/site";
import { getCommentTimeline } from "@/lib/tools";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SITE.name, url: "/", title: SITE.name, description: SITE.description },
};

/** The front page: HN's current stories, each opening its edition at /item?id=…, as on HN. */
export default function Home() {
  return (
    <PaperFrame masthead={<Masthead />}>
      <Suspense fallback={<FrontPageSkeleton />}>
        <Stories />
      </Suspense>
    </PaperFrame>
  );
}

async function Stories() {
  // The front page is live: ranked and dated at request time, never prerendered.
  await connection();
  // Cached for 15 minutes in production (lib/cache.ts).
  const stories = await cachedFor(keys.frontPage, FRONT_PAGE_TTL, fetchFrontPage);
  // The lead is the top story with an edition; the front page leaves the rest off (see FrontPage).
  const lead = stories.find((story) => coverable(story));
  return (
    <FrontPage
      stories={stories}
      lead={
        lead && (
          // The lead's thread can run to hundreds of comments: it streams in after the headlines.
          <Suspense fallback={null}>
            <Lead id={lead.id} />
          </Suspense>
        )
      }
    />
  );
}

/** The lead story's thread map and most-replied top-level comment; nothing if the thread can't be read. */
async function Lead({ id }: { id: number }) {
  const lead = await cachedFor(`${keys.frontPage}:lead:${id}`, FRONT_PAGE_TTL, () => leadConversation(id));
  return lead && <LeadConversation id={id} comments={lead.comments} top={lead.top} />;
}

async function leadConversation(id: number) {
  const fetched = await fetchThread(String(id)).catch(() => null);
  if (!fetched) return null;
  const { thread } = fetched;
  const top = thread.order
    .map((cid) => thread.comments[cid])
    .filter((c) => c.depth === 0)
    .sort((a, b) => b.replies - a.replies)[0];
  const text = top ? plainText(top.html).split("\n\n")[0] : "";
  const quote = text.length > 280 ? `${text.slice(0, 280)}…` : text;
  return {
    comments: getCommentTimeline(thread, { id }).comments,
    top: top ? { id: top.id, author: top.author, replies: top.replies, text: quote } : null,
  };
}
