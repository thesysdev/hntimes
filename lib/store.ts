import { createHash } from "node:crypto";
import { appendFile, mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Redis } from "@upstash/redis";
import { get, put } from "@vercel/blob";

// Persistent storage for the cache, in two parts:
// - a key-value side for small, hot records (pointers, locks, the front page, live streams), and
// - a blob side for large documents kept forever (editions, threads, articles).
// On Vercel these are Upstash Redis and Vercel Blob (private). Without their credentials (a local
// production build) both live in .cache/ on disk, which behaves the same on a single server.

export type Store = {
  get<T>(key: string): Promise<T | null>;
  /** Sets a value, expiring after `ttl` seconds if given. */
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  /** Sets a value only if the key is free; true if this call took it. For locks. */
  claim(key: string, value: unknown, ttl: number): Promise<boolean>;
  del(key: string): Promise<void>;
  /** Appends to a list (the events of a live stream), which expires after `ttl` seconds. */
  append(key: string, items: string[], ttl: number): Promise<void>;
  /** The list's items from index `from` on. */
  read(key: string, from: number): Promise<string[]>;
  putBlob(pathname: string, body: string): Promise<void>;
  getBlob(pathname: string): Promise<string | null>;
};

// ─── Vercel: Upstash Redis + Vercel Blob ─────────────────────────────────────

function redisFromEnv(): Redis | null {
  // Vercel's Upstash integration sets KV_REST_API_*; a direct Upstash setup sets UPSTASH_REDIS_REST_*.
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  // Values are encoded here, not by the client, so list items come back as the strings we pushed.
  return url && token ? new Redis({ url, token, automaticDeserialization: false }) : null;
}

function vercelStore(redis: Redis): Store {
  return {
    async get<T>(key: string) {
      const raw = await redis.get<string>(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    },
    async set(key, value, ttl) {
      const raw = JSON.stringify(value);
      await (ttl ? redis.set(key, raw, { ex: ttl }) : redis.set(key, raw));
    },
    async claim(key, value, ttl) {
      return (await redis.set(key, JSON.stringify(value), { nx: true, ex: ttl })) === "OK";
    },
    async del(key) {
      await redis.del(key);
    },
    async append(key, items, ttl) {
      if (items.length === 0) return;
      await redis.pipeline().rpush(key, ...items).expire(key, ttl).exec();
    },
    read: (key, from) => redis.lrange<string>(key, from, -1),
    async putBlob(pathname, body) {
      await put(pathname, body, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
    },
    async getBlob(pathname) {
      const result = await get(pathname, { access: "private" });
      if (!result?.stream) return null;
      return new Response(result.stream).text();
    },
  };
}

// ─── Local: .cache/ on disk ──────────────────────────────────────────────────

const ROOT = path.join(process.cwd(), ".cache");
/** A key as a safe file name. */
const fileOf = (dir: string, key: string) => path.join(ROOT, dir, createHash("sha256").update(key).digest("hex").slice(0, 32));

type Entry = { value: unknown; expires: number | null };

async function readEntry(file: string): Promise<Entry | null> {
  try {
    const entry = JSON.parse(await readFile(file, "utf8")) as Entry;
    if (entry.expires !== null && entry.expires < Date.now()) {
      await rm(file, { force: true });
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

function localStore(): Store {
  const write = async (file: string, body: string) => {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  };
  const entry = (value: unknown, ttl?: number) => JSON.stringify({ value, expires: ttl ? Date.now() + ttl * 1000 : null });
  return {
    async get<T>(key: string) {
      return ((await readEntry(fileOf("kv", key)))?.value as T) ?? null;
    },
    async set(key, value, ttl) {
      await write(fileOf("kv", key), entry(value, ttl));
    },
    async claim(key, value, ttl) {
      const file = fileOf("kv", key);
      await readEntry(file); // clears an expired lock
      await mkdir(path.dirname(file), { recursive: true });
      try {
        const handle = await open(file, "wx"); // fails if the file exists
        await handle.writeFile(entry(value, ttl));
        await handle.close();
        return true;
      } catch {
        return false;
      }
    },
    async del(key) {
      await rm(fileOf("kv", key), { force: true });
    },
    async append(key, items) {
      if (items.length === 0) return;
      const file = fileOf("list", key);
      await mkdir(path.dirname(file), { recursive: true });
      await appendFile(file, items.map((item) => `${JSON.stringify(item)}\n`).join(""));
    },
    async read(key, from) {
      const text = await readFile(fileOf("list", key), "utf8").catch(() => "");
      return text
        .split("\n")
        .filter(Boolean)
        .slice(from)
        .map((line) => JSON.parse(line) as string);
    },
    async putBlob(pathname, body) {
      await write(path.join(ROOT, "blob", pathname), body);
    },
    async getBlob(pathname) {
      return readFile(path.join(ROOT, "blob", pathname), "utf8").catch(() => null);
    },
  };
}

let store: Store | null = null;

/** The cache's storage: Upstash Redis and Vercel Blob when configured, otherwise .cache/ on disk. */
export function getStore(): Store {
  if (store) return store;
  const redis = redisFromEnv();
  const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  if (redis && !hasBlob) throw new Error("Redis is configured but BLOB_READ_WRITE_TOKEN is not: set both, or neither");
  store = redis ? vercelStore(redis) : localStore();
  return store;
}
