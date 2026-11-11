"use client";

import { Renderer } from "@openuidev/react-lang";
import { useState } from "react";
import { QuotedProvider } from "./Highlight";
import { library } from "./library";

type RenderError = { code?: string; message: string };

/** The tools an edition may Query, each backed by an API route. */
const tools = {
  get_comment_timeline: async (args: Record<string, unknown>) => {
    const response = await fetch(`/api/timeline/${encodeURIComponent(String(args.id))}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? `get_comment_timeline failed (${response.status})`);
    return body;
  },
};

/** Elements that point at one comment by id: quotes, and the people in a Cast. */
const BY_ID = new Set(["Quote", "PullQuote", "Person"]);

/** Comment ids quoted anywhere in a parsed program (Quote, PullQuote and Person elements). */
function quotedIds(node: unknown, ids = new Set<number>()): Set<number> {
  if (Array.isArray(node)) node.forEach((child) => quotedIds(child, ids));
  else if (node && typeof node === "object") {
    const el = node as { type?: string; typeName?: string; props?: { commentId?: unknown } };
    if (el.type === "element" && BY_ID.has(el.typeName ?? "") && typeof el.props?.commentId === "number")
      ids.add(el.props.commentId);
    Object.values(node).forEach((child) => quotedIds(child, ids));
  }
  return ids;
}

/** Renders an OpenUI Lang edition with the HN Times catalog and its tools. */
export function EditionRenderer({
  program,
  isStreaming = false,
  onErrors,
}: {
  program: string;
  isStreaming?: boolean;
  /** Parser and runtime errors once the program settles; [] when there are none. */
  onErrors?: (errors: RenderError[]) => void;
}) {
  const [quoted, setQuoted] = useState<ReadonlySet<number>>(new Set());

  return (
    <QuotedProvider ids={quoted}>
      <Renderer
        response={program}
        library={library}
        isStreaming={isStreaming}
        toolProvider={tools}
        onParseResult={(result) => {
          const ids = quotedIds(result?.root);
          setQuoted((previous) => (previous.size === ids.size ? previous : ids));
        }}
        onError={(errors) => {
          if (errors.length > 0) console.error("[hntimes] edition errors", JSON.stringify(errors, null, 2));
          onErrors?.(errors);
        }}
      />
    </QuotedProvider>
  );
}
