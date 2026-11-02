"use client";

import { useSyncExternalStore } from "react";
import { THEME_KEY, type Theme } from "@/lib/theme";
import styles from "./Masthead.module.css";

const darkQuery = () => matchMedia("(prefers-color-scheme: dark)");
const CHANGE = "hackerpaper-theme-change";

function currentTheme(): Theme {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "light" || chosen === "dark") return chosen;
  return darkQuery().matches ? "dark" : "light";
}

// The theme changes when the system setting does, or when this button sets one.
function subscribe(onChange: () => void) {
  const media = darkQuery();
  media.addEventListener("change", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

/** Switches between light and dark. Without a saved choice, the page follows the system. */
export function ThemeToggle() {
  // null on the server, which can't see the reader's system setting.
  const theme = useSyncExternalStore<Theme | null>(subscribe, currentTheme, () => null);

  function toggle() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the switch still works for this visit.
    }
    window.dispatchEvent(new Event(CHANGE));
  }

  const target = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className={styles.themeToggle}
      onClick={toggle}
      aria-label={theme ? `Switch to ${target} mode` : "Switch color theme"}
    >
      <span aria-hidden className={styles.themeIcon}>
        {theme === "dark" ? "☀" : "☾"}
      </span>
      {theme ? target : ""}
    </button>
  );
}
