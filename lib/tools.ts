import { hoursAfterPost, type Thread } from "./thread";

// Tools that generated editions call with Query(). The specs go into the system prompt;
// the implementations run in the renderer's toolProvider.

export type ThreadShapeComment = { id: number; parent: number; depth: number; hours: number };

export const commentTimelineSpec = {
  name: "get_comment_timeline",
  description:
    "The shape of an HN thread: every comment's id, the id it replies to, its reply depth (0 = top level), and hours since the post.",
  inputSchema: {
    type: "object",
    properties: { id: { type: "number", description: "The HN story id" } },
    required: ["id"],
  },
  outputSchema: {
    type: "object",
    properties: {
      comments: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "number" },
            parent: { type: "number" },
            depth: { type: "number" },
            hours: { type: "number" },
          },
        },
      },
    },
  },
};

export function getCommentTimeline(thread: Thread, args: Record<string, unknown>): { comments: ThreadShapeComment[] } {
  if (Number(args.id) !== thread.story.id) throw new Error(`Unknown story id ${String(args.id)}`);
  return {
    comments: thread.order.map((id) => {
      const c = thread.comments[id];
      return { id: c.id, parent: c.parent, depth: c.depth, hours: hoursAfterPost(thread, c.time) };
    }),
  };
}
