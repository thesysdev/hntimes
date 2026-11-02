import { connection } from "next/server";
import { Suspense } from "react";
import { FrontPage, FrontPageSkeleton, LeadConversation, Masthead, PaperFrame } from "@/components/paper";
import { fetchFrontPage, fetchThread } from "@/lib/hn";
import { plainText } from "@/lib/thread";
import { getCommentTimeline } from "@/lib/tools";

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
  const stories = await fetchFrontPage();
  const lead = stories[0];
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
  const fetched = await fetchThread(String(id)).catch(() => null);
  if (!fetched) return null;
  const { thread } = fetched;
  const top = thread.order
    .map((cid) => thread.comments[cid])
    .filter((c) => c.depth === 0)
    .sort((a, b) => b.replies - a.replies)[0];
  const text = top ? plainText(top.html).split("\n\n")[0] : "";
  const quote = text.length > 280 ? `${text.slice(0, 280)}…` : text;
  return (
    <LeadConversation
      id={id}
      comments={getCommentTimeline(thread, { id }).comments}
      top={top ? { id: top.id, author: top.author, replies: top.replies, text: quote } : null}
    />
  );
}
