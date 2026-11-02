import { caching, loadLatestThread } from "@/lib/cache";
import { loadSnapshot } from "@/lib/snapshots";
import { getCommentTimeline } from "@/lib/tools";

/**
 * GET /api/timeline/<story id>: the get_comment_timeline tool that editions call with Query().
 * Returns every comment's id, parent, depth and hours after the post, for the ThreadMap.
 * Reads the thread the edition was written from, so the map always matches the page's quotes: in
 * production the stored edition's (or the run's, while it's being written), in development the
 * snapshot in snapshots/.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return Response.json({ error: "id must be an HN story id" }, { status: 400 });

  const thread = caching ? await loadLatestThread(Number(id)) : await loadSnapshot(id);
  if (!thread) return Response.json({ error: `No thread for story ${id}` }, { status: 404 });

  return Response.json(getCommentTimeline(thread, { id }), { headers: { "Cache-Control": "no-store" } });
}
