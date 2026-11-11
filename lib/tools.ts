import { hoursAfterPost, type Thread } from "./thread";

// Tools that generated editions call with Query(). The prompt's skeleton rule shows the model the
// call; the renderer's toolProvider answers it through /api/timeline/<id>.

export type ThreadShapeComment = { id: number; parent: number; depth: number; hours: number };

export function getCommentTimeline(thread: Thread, args: Record<string, unknown>): { comments: ThreadShapeComment[] } {
  if (Number(args.id) !== thread.story.id) throw new Error(`Unknown story id ${String(args.id)}`);
  return {
    comments: thread.order.map((id) => {
      const c = thread.comments[id];
      return { id: c.id, parent: c.parent, depth: c.depth, hours: hoursAfterPost(thread, c.time) };
    }),
  };
}
