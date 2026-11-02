"use client";

import { parseMessage } from "@openuidev/lang-core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Thread } from "@/lib/thread";
import { type Desk, Dispatch, StillBuilding, TooQuiet } from "./Dispatch";
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
  | { type: "story"; title: string; author: string; comments: number; site: string | null }
  | { type: "brief"; shape: string; angle: string; headline: string; cast: string[] }
  | { type: "thread"; thread: Thread }
  | { type: "source"; name: string; ok: boolean; size: number; ms: number }
  | { type: "warning"; message: string }
  | { type: "text"; delta: string }
  | { type: "done"; model: string; ms: number; firstTokenMs: number }
  | { type: "building"; readyIn: number }
  | { type: "quiet"; settled: boolean }
  | { type: "error"; message: string };

// Timings, sources, the raw program and a rerun button are for development; readers get the paper.
const isDev = process.env.NODE_ENV === "development";

const SOURCE_LABELS: Record<string, string> = {
  fetch_hn_thread: "thread",
  fetch_article: "article",
  earlier_stories: "earlier stories",
  plan_edition: "editor",
  fetch_profiles: "profiles",
  search_images: "images",
};

/** A finished source as readers see it, or null for ones not worth a line. */
function readerStep(e: { name: string; ok: boolean; size: number }, site: string | null): string | null {
  if (!e.ok) return null;
  if (e.name === "fetch_hn_thread") return `Read all ${e.size.toLocaleString("en-US")} comments`;
  if (e.name === "fetch_article") return site ? `Read the article on ${site}` : "Read the article";
  if (e.name === "fetch_profiles") return `Looked up ${e.size} of the sources on Hacker News`;
  if (e.name === "earlier_stories")
    return `Found ${e.size} earlier ${e.size === 1 ? "discussion" : "discussions"} of ${site ?? "the site"}`;
  return null;
}

/** The route's progress messages, minus tooling details (models, search queries). */
function readerStatus(message: string): string {
  if (message.startsWith("Writing")) return "Writing the edition…";
  if (message.startsWith("Searching")) return "Finding lead art…";
  return message;
}

/**
 * Gateway wraps the program in a message envelope (`]]>openui:content … ]]>openui:end`) around a
 * fenced code block. Take the content section, then drop the fence, leaving the bare program.
 */
function programOf(raw: string, streaming: boolean): string {
  const { content } = parseMessage(raw, { streaming });
  return content.replace(/^\s*```[\w-]*\n/, "").replace(/\n?```\s*$/, "");
}

/** Why there's no edition to show: the story is too young, or its thread too quiet. */
type Notice = { type: "building"; readyIn: number } | { type: "quiet"; settled: boolean };

/**
 * The edition for one story. A cached edition (`initial`) renders at once; otherwise it's written
 * (or joined while being written) through /api/edition as soon as the page opens, and rendered as
 * it streams. In development a control strip shows progress and can write it again.
 */
export function LiveEdition({
  storyId,
  replay = false,
  initial,
}: {
  storyId: string;
  replay?: boolean;
  /** An edition already written, from the cache. */
  initial?: { program: string; thread: Thread };
}) {
  const [thread, setThread] = useState<Thread | null>(initial?.thread ?? null);
  const [program, setProgram] = useState(initial?.program ?? "");
  const [status, setStatus] = useState<Status>(initial ? "done" : "working");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [message, setMessage] = useState("Starting…");
  const [sources, setSources] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ message: string }[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [desk, setDesk] = useState<Desk>({ done: [], now: "Reading the thread…" });
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
        const response = replay
          ? await fetch(`/api/edition?id=${storyId}`, { signal: controller.signal })
          : await fetch("/api/edition", {
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
            if (e.type === "status") {
              setMessage(e.message);
              setDesk((d) => ({ ...d, now: readerStatus(e.message) }));
            } else if (e.type === "story") {
              const { title, author, comments, site } = e;
              setDesk((d) => ({ ...d, story: { title, author, comments, site } }));
            } else if (e.type === "brief") {
              const { shape, angle, headline, cast } = e;
              const sources = cast.length ? `, through ${cast.slice(0, 3).join(", ")}${cast.length > 3 ? " and others" : ""}` : "";
              setDesk((d) => ({ ...d, brief: { shape, angle, headline, cast }, done: [...d.done, `Assigned as a ${shape}${sources}`] }));
            } else if (e.type === "thread") setThread(e.thread);
            else if (e.type === "source") {
              setSources((s) => [
                ...s,
                `${SOURCE_LABELS[e.name] ?? e.name} ${e.ok ? "✓" : "–"} ${(e.ms / 1000).toFixed(1)}s`,
              ]);
              setDesk((d) => {
                const step = readerStep(e, d.story?.site ?? null);
                return step ? { ...d, done: [...d.done, step] } : d;
              });
            }
            else if (e.type === "warning") setWarnings((w) => [...w, e.message]);
            else if (e.type === "text") {
              raw += e.delta;
              setProgram(programOf(raw, true));
            } else if (e.type === "done") {
              setProgram(programOf(raw, false));
              setMessage(`${e.model} · first text ${(e.firstTokenMs / 1000).toFixed(1)}s`);
              setStatus("done");
            } else if (e.type === "building" || e.type === "quiet") {
              setNotice(e);
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
    [storyId, replay],
  );

  // Write the edition as soon as the page opens (unless it came from the cache); leaving the page
  // stops following it.
  useEffect(() => {
    if (initial) return;
    const controller = new AbortController();
    abort.current = controller;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- run() only sets state after its first await (the request)
    run(controller);
    return () => controller.abort();
  }, [run, initial]);

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
    setDesk({ done: [], now: "Reading the thread…" });
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
      {status === "working" && !(thread && program) && <Dispatch desk={desk} />}
      {notice?.type === "building" && (
        <StillBuilding title={desk.story?.title ?? "This story"} readyIn={notice.readyIn} />
      )}
      {notice?.type === "quiet" && <TooQuiet title={desk.story?.title ?? "This story"} settled={notice.settled} />}
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
