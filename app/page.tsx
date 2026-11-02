import { Suspense } from "react";
import { FrontPage, FrontPageSkeleton, Masthead, PaperFrame } from "@/components/paper";
import { fetchFrontPage } from "@/lib/hn";

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
  return <FrontPage stories={await fetchFrontPage()} />;
}
