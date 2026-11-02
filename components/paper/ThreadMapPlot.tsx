"use client";

import { useRef, useState } from "react";
import { formatElapsed, getComment, hnItemUrl, hoursAfterPost, plainText } from "@/lib/thread";
import { useHighlight } from "./Highlight";
import { useOptionalThread } from "./ThreadContext";
import styles from "./ThreadMap.module.css";

export type Dot = {
  id: number;
  x: number;
  y: number;
  px: number | null;
  py: number | null;
  quoted: boolean;
};

export function ThreadMapPlot({
  width,
  height,
  dots,
  ticks,
}: {
  width: number;
  height: number;
  dots: Dot[];
  ticks: { x: number; label: string }[];
}) {
  const { active, setActive } = useHighlight();
  const thread = useOptionalThread();
  const svg = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<Dot | null>(null);
  const axisY = height - 16;

  /** The dot nearest the pointer, within reach; null over empty space. */
  function nearest(event: React.PointerEvent): Dot | null {
    const matrix = svg.current?.getScreenCTM()?.inverse();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
    let best: Dot | null = null;
    let bestDistance = 14 ** 2;
    for (const d of dots) {
      const distance = (d.x - point.x) ** 2 + (d.y - point.y) ** 2;
      if (distance < bestDistance) [best, bestDistance] = [d, distance];
    }
    return best;
  }

  // Previews need the thread's text, which the front page's map doesn't have.
  const comment = thread && hover ? getComment(thread, hover.id) : null;
  const preview = comment && plainText(comment.html).replace(/\s+/g, " ");

  return (
    <div className={styles.plotWrap}>
      <svg
        ref={svg}
        viewBox={`0 0 ${width} ${height}`}
        className={styles.plot}
        role="img"
        aria-label="Map of the comment thread by time and reply depth"
        data-interactive={thread ? true : undefined}
        onPointerMove={(event) => {
          if (!thread) return;
          const dot = nearest(event);
          if (dot?.id === hover?.id) return;
          setHover(dot);
          setActive(dot?.id ?? null);
        }}
        onPointerLeave={() => {
          setHover(null);
          setActive(null);
        }}
        onClick={() => hover && window.open(hnItemUrl(hover.id), "_blank", "noopener")}
      >
        {ticks.map((t) => (
          <g key={t.label}>
            <line x1={t.x} x2={t.x} y1={0} y2={axisY} className={styles.tick} />
            <text x={t.x} y={height - 2} className={styles.tickLabel}>
              {t.label}
            </text>
          </g>
        ))}
        {dots.map(
          (d) =>
            d.px !== null &&
            d.py !== null && (
              <path
                key={`l${d.id}`}
                d={`M${d.px},${d.py} C${d.px},${d.y} ${d.px},${d.y} ${d.x},${d.y}`}
                className={styles.branch}
              />
            ),
        )}
        {dots.map((d) => (
          <circle
            key={d.id}
            cx={d.x}
            cy={d.y}
            r={d.quoted ? 4 : 2}
            className={d.quoted ? styles.quoted : styles.dot}
            data-active={active === d.id || undefined}
          />
        ))}
      </svg>
      {hover && comment && preview && (
        <div
          className={styles.preview}
          style={{ left: `${(hover.x / width) * 100}%`, top: `${(hover.y / height) * 100}%` }}
          data-flip={hover.x > width * 0.6 || undefined}
          aria-hidden
        >
          <span className={styles.previewMeta}>
            <strong>{comment.author}</strong> · {formatElapsed(hoursAfterPost(thread!, comment.time))}
            {comment.replies > 0 && ` · ${comment.replies} ${comment.replies === 1 ? "reply" : "replies"}`}
          </span>
          <span className={styles.previewText}>{preview.length > 220 ? `${preview.slice(0, 220)}…` : preview}</span>
        </div>
      )}
    </div>
  );
}
