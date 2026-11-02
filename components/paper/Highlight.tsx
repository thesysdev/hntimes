"use client";

import { createContext, useContext, useState } from "react";

// Links quotes in the text to their dots on the thread map.
const HighlightContext = createContext<{
  active: number | null;
  setActive: (id: number | null) => void;
}>({ active: null, setActive: () => {} });

export function HighlightProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<number | null>(null);
  return <HighlightContext value={{ active, setActive }}>{children}</HighlightContext>;
}

export function useHighlight() {
  return useContext(HighlightContext);
}

// Every comment id the edition quotes, read from the parsed program, so the thread map can mark
// them without the model having to list them.
const QuotedContext = createContext<ReadonlySet<number>>(new Set());

export function QuotedProvider({ ids, children }: { ids: ReadonlySet<number>; children: React.ReactNode }) {
  return <QuotedContext value={ids}>{children}</QuotedContext>;
}

export function useQuotedIds() {
  return useContext(QuotedContext);
}

/** Marks its children as showing comment `id`; hovering or focusing lights it up on the map. */
export function HighlightTarget({
  id,
  className,
  inline = false,
  children,
}: {
  id: number;
  className?: string;
  /** Render as a span, for targets inside a paragraph. */
  inline?: boolean;
  children: React.ReactNode;
}) {
  const { active, setActive } = useHighlight();
  const Tag = inline ? "span" : "div";
  return (
    <Tag
      className={className}
      data-active={active === id || undefined}
      onMouseEnter={() => setActive(id)}
      onMouseLeave={() => setActive(null)}
      onFocus={() => setActive(id)}
      onBlur={() => setActive(null)}
    >
      {children}
    </Tag>
  );
}
