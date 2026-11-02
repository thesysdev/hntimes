"use client";

import { createContext, useContext } from "react";
import type { Thread } from "@/lib/thread";

// Paper components resolve comment ids, links and the article from here.
// It lives on the client because the OpenUI renderer does.
const ThreadContext = createContext<Thread | null>(null);

export function ThreadProvider({ thread, children }: { thread: Thread; children: React.ReactNode }) {
  return <ThreadContext value={thread}>{children}</ThreadContext>;
}

export function useThread(): Thread {
  const thread = useContext(ThreadContext);
  if (!thread) throw new Error("Paper components must render inside <ThreadProvider>");
  return thread;
}

