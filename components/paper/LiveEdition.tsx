"use client";

import { parseMessage } from "@openuidev/lang-core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Thread } from "@/lib/thread";
import { EditionRenderer } from "./EditionRenderer";
import { HighlightProvider } from "./Highlight";
import styles from "./LiveEdition.module.css";
import { Masthead } from "./Masthead";
import { PaperFrame } from "./Paper";
import { ThreadProvider } from "./ThreadContext";

type Status = "working" | "done" | "error";

/** One line of the /api/edition NDJSON stream. */
type EditionEvent =
  | { type: "status"; message: string }
  | { type: "thread"; thread: Thread }
  | { type: "source"; name: string; ok: boolean; size: number; ms: number }
  | { type: "warning"; message: string }
  | { type: "text"; delta: string }
  | { type: "done"; model: string; ms: number; firstTokenMs: number }
  | { type: "error"; message: string };

// Timings, sources, the raw program and a rerun button are for development; readers get the paper.
const isDev = process.env.NODE_ENV === "development";

const SOURCE_LABELS: Record<string, string> = {
  fetch_hn_thread: "thread",
  fetch_article: "article",
  plan_image: "image query",
  search_images: "images",
};

/**
 * Gateway wraps the program in a message envelope (`]]>openui:content … ]]>openui:end`) around a
 * fenced code block. Take the content section, then drop the fence, leaving the bare program.
 */
function programOf(raw: string, streaming: boolean): string {
  const { content } = parseMessage(raw, { streaming });
  return content.replace(/^\s*```[\w-]*\n/, "").replace(/\n?```\s*$/, "");
}

/**
 * The edition for one story: gathered and written through /api/edition as soon as the page opens,
 * and rendered as it streams. A control strip shows progress and can write it again.
 */
export function LiveEdition({ storyId }: { storyId: string }) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [program, setProgram] = useState("");
  const [status, setStatus] = useState<Status>("working");
  const [message, setMessage] = useState("Starting…");
  const [sources, setSources] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ message: string }[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [showProgram, setShowProgram] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (status !== "working") return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - started) / 1000), 200);
    return () => clearInterval(timer);
  }, [status]);

  /** Streams one edition into state. Every state update happens after the request starts. */
  const run = useCallback(
    async (controller: AbortController) => {
      try {
        const response = await fetch("/api/edition", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: `https://news.ycombinator.com/item?id=${storyId}`,
          }),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? `Request failed (${response.status})`);
        }

        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        let raw = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines.filter(Boolean)) {
            const e = JSON.parse(line) as EditionEvent;
            if (e.type === "status") setMessage(e.message);
            else if (e.type === "thread") setThread(e.thread);
            else if (e.type === "source")
              setSources((s) => [
                ...s,
                `${SOURCE_LABELS[e.name] ?? e.name} ${e.ok ? "✓" : "–"} ${(e.ms / 1000).toFixed(1)}s`,
              ]);
            else if (e.type === "warning") setWarnings((w) => [...w, e.message]);
            else if (e.type === "text") {
              raw += e.delta;
              setProgram(programOf(raw, true));
            } else if (e.type === "done") {
              setProgram(programOf(raw, false));
              setMessage(`${e.model} · first text ${(e.firstTokenMs / 1000).toFixed(1)}s`);
              setStatus("done");
            } else if (e.type === "error") throw new Error(e.message);
          }
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : String(error));
      }
    },
    [storyId],
  );

  // Write the edition as soon as the page opens; leaving the page cancels it.
  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- run() only sets state after its first await (the request)
    run(controller);
    return () => controller.abort();
  }, [run]);

  function writeAgain() {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setThread(null);
    setProgram("");
    setErrors([]);
    setSources([]);
    setWarnings([]);
    setMessage("Starting…");
    setElapsed(0);
    setStatus("working");
    run(controller);
  }

  const lines = program ? program.split("\n").length : 0;
  return (
    <PaperFrame masthead={<Masthead edition={thread?.story.id ?? Number(storyId)} />}>
      {isDev && (
        <div className={styles.bar}>
          <span className={styles.meta} role="status">
            {status === "working" && `${message} · ${elapsed.toFixed(1)}s · ${lines} lines`}
            {status === "done" && `Written in ${elapsed.toFixed(1)}s · ${lines} lines · ${message}`}
            {status === "error" && <span className={styles.error}>{message}</span>}
          </span>
          {sources.length > 0 && <span className={styles.meta}>{sources.join(" · ")}</span>}
          {warnings.map((w) => (
            <span key={w} className={styles.error}>
              {w}
            </span>
          ))}
          {status === "done" && errors.length > 0 && (
            <span className={styles.error}>{errors.length} renderer errors (see console)</span>
          )}
          {program && (
            <button
              type="button"
              className={styles.toggle}
              onClick={() => setShowProgram((s) => !s)}
            >
              {showProgram ? "Hide program" : "View program"}
            </button>
          )}
          {status !== "working" && (
            <button type="button" className={styles.generate} onClick={writeAgain}>
              Write again
            </button>
          )}
        </div>
      )}
      {!isDev && status === "error" && (
        <p className={styles.error} role="alert">
          {message}
        </p>
      )}
      {isDev && showProgram && <pre className={styles.program}>{program}</pre>}
      {thread && program && (
        <ThreadProvider thread={thread}>
          <HighlightProvider>
            <EditionRenderer
              program={program}
              isStreaming={status === "working"}
              onErrors={setErrors}
            />
          </HighlightProvider>
        </ThreadProvider>
      )}
    </PaperFrame>
  );
}
