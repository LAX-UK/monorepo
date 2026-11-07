import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadShopEnv } from "@/env";
import type { ShopImageFacts, ShopImageProbe } from "@/lib/home/home-image-facts";

const TIMEOUT_MS = 2500;
const MAX_BYTES = 12 * 1024 * 1024;
const CACHE_LIMIT = 200;

/** Where the bytes of a picture come from; a source returns `null` when it has nothing. */
export type ImageByteSource = (src: string) => Promise<Buffer | null>;

/** Measures a picture's size and mean colour from its bytes. */
async function measure(bytes: Buffer): Promise<ShopImageFacts | null> {
  if (bytes.length > MAX_BYTES) return null;
  const { default: sharp } = await import("sharp");
  const { width, height } = await sharp(bytes).metadata();
  if (!width || !height) return null;
  const { channels } = await sharp(bytes).resize(32, 32, { fit: "inside" }).removeAlpha().stats();
  const [r, g, b] = channels.map((channel: { mean: number }) => channel.mean);
  if (r === undefined || g === undefined || b === undefined) return null;
  return { width, height, mean: [r, g, b] };
}

/**
 * A picture the Shop itself serves from its public folder. It is read from disk: the server never
 * needs to call its own public address (through the CDN and back) to look at a file it holds.
 */
export function readFromPublicFolder(publicDir: string): ImageByteSource {
  const root = path.resolve(publicDir);
  return async (src) => {
    if (!src.startsWith("/") || src.startsWith("//")) return null;
    const file = path.resolve(root, `.${decodeURIComponent(src.split("?")[0] ?? "")}`);
    if (!file.startsWith(`${root}${path.sep}`)) return null;
    try {
      return await readFile(file);
    } catch {
      return null;
    }
  };
}

/** A picture on another host, fetched once within the time limit. */
const readFromNetwork: ImageByteSource = async (src) => {
  let url = src;
  if (!/^https?:\/\//i.test(src)) {
    const env = loadShopEnv();
    const origin = env.LAX_SHOP_STOREFRONT_URL ?? env.SHOP_STOREFRONT_URL;
    if (!origin) return null;
    url = `${origin.replace(/\/+$/, "")}${src}`;
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  if (Number(response.headers.get("content-length") ?? 0) > MAX_BYTES) return null;
  return Buffer.from(await response.arrayBuffer());
};

/**
 * Builds a probe that tries each source in turn. A picture that cannot be read is `null` and the
 * page leaves it out rather than guess its shape; the first failure for an address is logged so a
 * cover that falls back to type can be traced. Reads are remembered for the life of the server.
 */
export function createImageProbe(
  sources: readonly ImageByteSource[],
  warn: (message: string, detail: unknown) => void = (message, detail) =>
    console.warn(message, detail),
): ShopImageProbe {
  const cache = new Map<string, ShopImageFacts>();
  const reported = new Set<string>();
  return async (src) => {
    const known = cache.get(src);
    if (known) return known;
    let failure: unknown = "no source could provide the picture";
    for (const source of sources) {
      try {
        const bytes = await source(src);
        const facts = bytes ? await measure(bytes) : null;
        if (!facts) continue;
        if (cache.size >= CACHE_LIMIT) cache.clear();
        cache.set(src, facts);
        return facts;
      } catch (error) {
        failure = error;
      }
    }
    if (!reported.has(src) && reported.size < CACHE_LIMIT) {
      reported.add(src);
      warn("[shop] home picture could not be read; the first screen falls back", {
        src,
        reason: failure instanceof Error ? failure.message : String(failure),
      });
    }
    return null;
  };
}

export const shopImageProbe: ShopImageProbe = createImageProbe([
  readFromPublicFolder(path.join(process.cwd(), "public")),
  readFromNetwork,
]);
