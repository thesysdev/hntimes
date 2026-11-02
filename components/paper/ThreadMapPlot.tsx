"use client";

import { useHighlight } from "./Highlight";
import styles from "./ThreadMap.module.css";

export type Dot = {
  id: number;
  x: number;
  y: number;
  px: number | null;
  py: number | null;
  quoted: boolean;
};

/** The plot itself. Hovering a quote on the page lights its dot here. */
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
  const { active } = useHighlight();
  const axisY = height - 16;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={styles.plot}
      role="img"
      aria-label="Map of the comment thread by time and reply depth"
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
  );
}
