/**
 * The cache version. Every cache key includes it, so changing this string starts every page,
 * article and edition afresh (old versions stay in storage, untouched). Bump it whenever a change
 * to the prompt, catalog or agent should reach editions that are already cached.
 */
export const CACHE_VERSION = "2026-11-03.3";
