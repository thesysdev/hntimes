"use client";

import { useSyncExternalStore } from "react";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const noop = () => () => {};

/** Today's date in the reader's own time zone. Empty on the server, which doesn't know it. */
export function Today() {
  const today = useSyncExternalStore(noop, () => dateFormat.format(new Date()), () => "");
  return <>{today}</>;
}
