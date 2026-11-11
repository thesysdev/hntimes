export type Theme = "light" | "dark";

export const THEME_KEY = "hntimes-theme";

/**
 * Runs in <head> before first paint so a saved choice never flashes the other theme.
 * Kept as a string because it must run before React loads.
 */
export const themeScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
