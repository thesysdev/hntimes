// Reads a web page's main text through Exa's contents API, so our server never fetches arbitrary
// URLs itself. Needs EXA_API_KEY. https://docs.exa.ai/reference/get-contents

export type ExaPage = { url: string; title: string | null; text: string; image: string | null };

type ExaResponse = {
  results?: { url: string; title?: string | null; text?: string; image?: string | null }[];
  statuses?: { id: string; status: "success" | "error"; error?: { tag?: string; httpStatusCode?: number } }[];
  error?: string;
};

const TIMEOUT_MS = 20_000;

/** The page's text (cut to `maxCharacters`), title and preview image, or null if Exa can't read it. */
export async function fetchPage(url: string, maxCharacters: number): Promise<ExaPage | null> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) throw new Error("EXA_API_KEY is not set");

  const response = await fetch("https://api.exa.ai/contents", {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    // livecrawl "fallback": use Exa's cached copy when it has one, crawl the page when it doesn't.
    body: JSON.stringify({ urls: [url], text: { maxCharacters }, livecrawl: "fallback" }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as ExaResponse;
  if (!response.ok) throw new Error(`Exa ${response.status}: ${body.error ?? "request failed"}`);

  const page = body.results?.[0];
  if (!page?.text?.trim()) return null; // paywall, PDF it couldn't parse, blocked, empty
  return { url: page.url, title: page.title ?? null, text: page.text.trim(), image: page.image ?? null };
}
