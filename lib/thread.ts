export type Comment = {
  id: number;
  author: string;
  time: number;
  parent: number;
  depth: number;
  replies: number;
  html: string;
};

export type Thread = {
  story: {
    id: number;
    title: string;
    url: string | null;
    /** The post's own body (Ask HN, Show HN), as HN HTML; absent for plain links. */
    text?: string | null;
    author: string;
    points: number;
    time: number;
    commentCount: number;
    topLevelCount: number;
  };
  article: { url: string; text: string } | null;
  /** HN profiles of the people the edition is told through, by username. */
  people?: Record<string, { karma: number; about: string }>;
  comments: Record<string, Comment>;
  order: number[];
  links: Record<string, number[]>;
};

export function getComment(thread: Thread, id: number): Comment | null {
  return thread.comments[id] ?? null;
}

const ENTITIES: Record<string, string> = {
  "&#x27;": "'",
  "&quot;": '"',
  "&gt;": ">",
  "&lt;": "<",
  "&#x2F;": "/",
  "&amp;": "&",
};

export function decode(s: string): string {
  return s.replace(/&#x27;|&quot;|&gt;|&lt;|&#x2F;|&amp;/g, (m) => ENTITIES[m]);
}

/** Comment HTML as plain-text paragraphs. Links keep their visible text. */
export function paragraphs(html: string): string[] {
  return html
    .split(/<p>/)
    .map((p) => decode(p.replace(/<[^>]+>/g, "")).trim())
    .filter(Boolean);
}

export function plainText(html: string): string {
  return paragraphs(html).join("\n\n");
}

function normalize(s: string): string {
  return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
}

/** True when `excerpt` appears verbatim (ignoring whitespace and curly quotes) in `source`. */
export function isVerbatim(source: string, excerpt: string): boolean {
  return normalize(source).includes(normalize(excerpt));
}

/**
 * The comment a quote comes from. Its excerpt must appear word for word in it. If it doesn't (the
 * model slipped a digit in the id), the one comment it does appear in, when there's exactly one.
 * Otherwise null: a quote that can't be placed is never shown, and never shown as someone else's.
 */
export function quotedComment(thread: Thread, id: number, excerpt?: string): Comment | null {
  const comment = getComment(thread, id);
  if (!excerpt) return comment;
  if (comment && isVerbatim(plainText(comment.html), excerpt)) return comment;
  const matches = thread.order.filter((cid) => isVerbatim(plainText(thread.comments[cid].html), excerpt));
  return matches.length === 1 ? thread.comments[matches[0]] : null;
}

/**
 * The program with each quote's id corrected by quotedComment, so stored editions (and their map)
 * point at the comment each excerpt really came from.
 */
export function repairQuotes(program: string, thread: Thread): string {
  return program.replace(/\b(Quote|PullQuote)\((\d+), "((?:[^"\\]|\\.)*)"/g, (match, kind: string, id: string, raw: string) => {
    let excerpt: string;
    try {
      excerpt = JSON.parse(`"${raw}"`) as string;
    } catch {
      return match;
    }
    const comment = quotedComment(thread, Number(id), excerpt);
    return comment && comment.id !== Number(id) ? `${kind}(${comment.id}, "${raw}"` : match;
  });
}

/** True when each comment replies directly to the one before it. */
export function isReplyChain(thread: Thread, ids: number[]): boolean {
  return ids.every((id, i) => {
    const c = getComment(thread, id);
    return c !== null && (i === 0 || c.parent === ids[i - 1]);
  });
}

export function hnItemUrl(id: number): string {
  return `https://news.ycombinator.com/item?id=${id}`;
}

export function hnUserUrl(name: string): string {
  return `https://news.ycombinator.com/user?id=${encodeURIComponent(name)}`;
}

export function hoursAfterPost(thread: Thread, time: number): number {
  return (time - thread.story.time) / 3600;
}

export function formatElapsed(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min in`;
  if (hours < 48) return `${Math.round(hours)}h in`;
  return `day ${Math.floor(hours / 24) + 1}`;
}
