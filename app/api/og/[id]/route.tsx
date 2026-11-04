import { cover } from "@/lib/cover";
import { ogImage } from "@/lib/og";

/**
 * GET /api/og/<story id>: an edition's share image, its headline under the nameplate. Linked from
 * the item page's metadata (the page's address carries the id in its query, which the
 * opengraph-image convention can't read). Cached at the edge for as long as an edition is current.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return new Response("id must be an HN story id", { status: 400 });
  const found = await cover(Number(id));
  if (!found) return new Response("No such story", { status: 404 });
  const { story } = found;
  const footer = story
    ? `${story.points.toLocaleString("en-US")} points · ${story.comments.toLocaleString("en-US")} comments on Hacker News`
    : null;
  return ogImage(
    { kicker: found.kicker, title: found.title, dek: found.dek, footer },
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400" } },
  );
}
