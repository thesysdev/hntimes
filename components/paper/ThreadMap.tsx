import type { ThreadShapeComment } from "@/lib/tools";
import { useQuotedIds } from "./Highlight";
import { ThreadMapPlot, type Dot } from "./ThreadMapPlot";
import styles from "./ThreadMap.module.css";

const WIDTH = 1152; // matches the full page width (--page), so the plot renders at 1:1 on desktop
const PAD_X = 6;
const PAD_TOP = 10;
const AXIS = 22;
/** Most space between reply levels; deep threads squeeze their rows to fit HEIGHT. */
const MAX_ROW = 22;
/** Tick spacings in hours; the smallest that gives at most eight ticks is used. */
const TICK_STEPS = [0.25, 0.5, 1, 2, 3, 6, 12, 24, 48];
/**
 * One height for every thread (room for seven levels at full spacing), so the page doesn't move
 * when the map's data arrives while the story is streaming in below it.
 */
const HEIGHT = PAD_TOP * 2 + AXIS + MAX_ROW * 7;

function hoursLabel(hours: number): string {
  return hours < 1 ? `${Math.round(hours * 60)}m` : `${hours}h`;
}

/**
 * The shape of the conversation: time across, reply depth down, quoted comments marked.
 * `comments` comes from the get_comment_timeline tool, so geometry and counts come only from data.
 */
export function ThreadMap({
  comments,
  quoted = [],
  caption,
}: {
  comments: ThreadShapeComment[];
  quoted?: number[];
  /** Replaces the caption's last sentence, which explains the orange dots. */
  caption?: React.ReactNode;
}) {
  const quotedOnPage = useQuotedIds();
  if (comments.length === 0) {
    return (
      <figure className={styles.map} aria-busy>
        <div className={styles.loading} style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }} />
        <figcaption className={styles.caption}>
          <strong>The thread, mapped.</strong> Loading the comments…
        </figcaption>
      </figure>
    );
  }

  const byId = new Map(comments.map((c) => [c.id, c]));
  // The scale starts where the conversation does, not at the post: a resubmitted story keeps its old
  // post time (often with a stray early comment), and its conversation would otherwise be squeezed
  // against the right edge. The 5th percentile ignores those strays; they sit at the left edge.
  const times = comments.map((c) => c.hours).sort((a, b) => a - b);
  const start = times[Math.floor(times.length * 0.05)];
  const span = Math.max(times[times.length - 1] - start, 0.25);
  const maxDepth = Math.max(...comments.map((c) => c.depth));
  const topLevel = comments.filter((c) => c.depth === 0).length;
  // Linear time: equal widths are equal stretches of time.
  const x = (hours: number) => PAD_X + (Math.max(0, hours - start) / span) * (WIDTH - PAD_X * 2);
  const row = Math.min(MAX_ROW, (HEIGHT - PAD_TOP * 2 - AXIS) / Math.max(1, maxDepth));
  const y = (depth: number) => PAD_TOP + depth * row;

  const quotedSet = new Set([...quoted, ...quotedOnPage]);
  const dots: Dot[] = comments.map((c) => {
    const parent = byId.get(c.parent);
    return {
      id: c.id,
      x: x(c.hours),
      y: y(c.depth),
      px: parent ? x(parent.hours) : null,
      py: parent ? y(parent.depth) : null,
      quoted: quotedSet.has(c.id),
    };
  });
  // Ticks count from the start of the conversation; "+" marks them as such when that's well after the post.
  const relative = start > 1 ? "+" : "";
  const step = TICK_STEPS.find((s) => span / s <= 8) ?? TICK_STEPS[TICK_STEPS.length - 1];
  const ticks = Array.from({ length: Math.floor(span / step) }, (_, i) => (i + 1) * step).map((h) => ({
    x: x(start + h),
    label: `${relative}${hoursLabel(h)}`,
  }));
  const duration = span < 36 ? `${Math.max(1, Math.round(span))} hours` : `${Math.round(span / 24)} days`;

  return (
    <figure className={styles.map}>
      <ThreadMapPlot width={WIDTH} height={HEIGHT} dots={dots} ticks={ticks} />
      <figcaption className={styles.caption}>
        <strong>The thread, mapped.</strong> {comments.length} comments over {duration},{" "}
        {topLevel} of them starting new discussions, replies nesting {maxDepth} deep.{" "}
        {caption ?? (
          <>
            Each dot is a comment; <span className={styles.key}>orange</span> dots are quoted on this page.
          </>
        )}
      </figcaption>
    </figure>
  );
}
