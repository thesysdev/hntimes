// Fetches an HN thread from the Algolia API and writes a normalized fixture to data/<id>.json.
// Usage: node scripts/fetch-thread.mjs <id>
// If data/<id>.article.txt exists, its text is embedded as the article.
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const id = process.argv[2];
if (!id) throw new Error("usage: node scripts/fetch-thread.mjs <id>");

const res = await fetch(`https://hn.algolia.com/api/v1/items/${id}`);
if (!res.ok) throw new Error(`HN fetch failed: ${res.status}`);
const raw = await res.json();

const comments = {};
const order = [];
const links = {};

function countReplies(node) {
  return (node.children ?? []).reduce((n, c) => n + 1 + countReplies(c), 0);
}

function walk(node, depth) {
  for (const child of node.children ?? []) {
    if (!child.text || !child.author) continue; // deleted or dead
    comments[child.id] = {
      id: child.id,
      author: child.author,
      time: child.created_at_i,
      parent: child.parent_id,
      depth,
      replies: countReplies(child),
      html: child.text,
    };
    order.push(child.id);
    for (const [, href] of child.text.matchAll(/href="([^"]+)"/g)) {
      const url = href.replaceAll("&#x2F;", "/").replaceAll("&amp;", "&");
      (links[url] ??= []).push(child.id);
    }
    walk(child, depth + 1);
  }
}
walk(raw, 0);

const articlePath = `data/${id}.article.txt`;
const article = existsSync(articlePath)
  ? { url: raw.url, text: await readFile(articlePath, "utf8") }
  : null;

const thread = {
  story: {
    id: raw.id,
    title: raw.title,
    url: raw.url,
    author: raw.author,
    points: raw.points,
    time: raw.created_at_i,
    commentCount: order.length,
    topLevelCount: raw.children.filter((c) => comments[c.id]).length,
  },
  article,
  comments,
  order,
  links,
};

await writeFile(`data/${id}.json`, JSON.stringify(thread));
console.log(`wrote data/${id}.json: ${order.length} comments, ${Object.keys(links).length} links`);
