// Checks an OpenUI Lang edition: it must parse against the Hackerpaper catalog, include the thread
// map, and every quote must come from the thread (known comment id, verbatim excerpt).
// Regenerate the schema first: npx @openuidev/cli generate components/paper/library.tsx --json-schema --out generated/schema.json
// Usage: node scripts/check-edition.mjs runs/<file>.oui
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { createParser } from "@openuidev/react-lang";

const file = process.argv[2];
if (!file) throw new Error("usage: node scripts/check-edition.mjs <edition.oui>");

const schema = JSON.parse(await readFile("generated/schema.json", "utf8"));
const program = await readFile(file, "utf8");
// The story id leads the file name: runs/<id>--<time>--<model>.oui.
// Its thread is the snapshot the edition was written from (snapshots/).
const storyId = basename(file).match(/^\d+/)?.[0];
const thread = JSON.parse(
  await readFile(`snapshots/${storyId}.json`, "utf8"),
);
const result = createParser(schema, "Edition").parse(program);
const problems = [...(result.meta?.errors ?? [])];

// Same normalisation as lib/thread.ts: entities decoded, tags dropped, quotes and spaces folded.
const decode = (s) =>
  s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&#x2F;/g, "/").replace(/&amp;/g, "&");
const plain = (html) => html.split(/<p>/).map((p) => decode(p.replace(/<[^>]+>/g, "")).trim()).join(" ");
const fold = (s) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

const elements = [];
(function walk(node) {
  if (Array.isArray(node)) return node.forEach(walk);
  if (!node || typeof node !== "object") return;
  if (node.type === "element") elements.push(node);
  Object.values(node).forEach(walk);
})(result.root);

const quoted = new Set();
for (const el of elements.filter((e) => e.typeName === "Quote" || e.typeName === "PullQuote")) {
  const { id, excerpt } = el.props;
  const comment = thread.comments[id];
  if (!comment) {
    problems.push({ code: "unknown-comment", message: `${el.typeName}(${id}): no such comment` });
    continue;
  }
  quoted.add(id);
  if (excerpt && !fold(plain(comment.html)).includes(fold(excerpt)))
    problems.push({ code: "not-verbatim", message: `${el.typeName}(${id}) by ${comment.author}: "${excerpt}"` });
}
for (const el of elements.filter((e) => ["Question", "Person", "Fact", "Event"].includes(e.typeName))) {
  const { id } = el.props;
  if (id !== undefined && !thread.comments[id]) problems.push({ code: "unknown-comment", message: `${el.typeName}(${id})` });
}

// Text with cite slots and @handles: every {n} needs its Quote, every @name must be in the thread.
const people = new Set([thread.story.author, ...Object.values(thread.comments).map((c) => c.author)]);
for (const el of elements.filter((e) => e.typeName === "Prose" || e.typeName === "Lede")) {
  const { text = "", cites = [] } = el.props;
  for (const [, n] of text.matchAll(/\{(\d+)\}/g))
    if (!cites[Number(n) - 1]) problems.push({ code: "empty-slot", message: `${el.typeName}: {${n}} has no cite` });
  for (const [, name] of text.matchAll(/@([\w-]+)/g))
    if (!people.has(name)) problems.push({ code: "unknown-handle", message: `${el.typeName}: @${name} is not in the thread` });
}
// Every edition needs the thread map (its quoted dots are derived from the program, so no list to check).
if (!elements.some((e) => e.typeName === "ThreadMap"))
  problems.push({ code: "missing-map", message: "the edition has no ThreadMap" });
if (!result.meta?.queryStatements?.length && !/Query\("get_comment_timeline"/.test(program))
  problems.push({ code: "missing-timeline", message: 'no Query("get_comment_timeline", …) for the ThreadMap' });

console.log(`root: ${result.root?.typeName ?? "none"}, components: ${elements.length}, quoted comments: ${quoted.size}`);
if (problems.length > 0) {
  console.error(JSON.stringify(problems, null, 2));
  process.exit(1);
}
console.log("no problems");
