import "server-only";

import { loadShopEnv } from "@/env";
import type { ShopImageFacts, ShopImageProbe } from "@/lib/home/home-image-facts";

const TIMEOUT_MS = 2500;
const MAX_BYTES = 12 * 1024 * 1024;
const CACHE_LIMIT = 200;
const cache = new Map<string, ShopImageFacts>();

function absolute(src: string): string | null {
  if (/^https?:\/\//i.test(src)) return src;
  const env = loadShopEnv();
  const origin = env.LAX_SHOP_STOREFRONT_URL ?? env.SHOP_STOREFRONT_URL;
  return origin ? `${origin.replace(/\/+$/, "")}${src}` : null;
}

async function read(url: string): Promise<ShopImageFacts | null> {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) return null;
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
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
 * Reads a print photograph's size and colour by fetching it once. A picture that cannot be read
 * in time is `null` and the page leaves it out rather than guess its shape. Reads are remembered
 * for the life of the server.
 */
export const shopImageProbe: ShopImageProbe = async (src) => {
  const url = absolute(src);
  if (!url) return null;
  const known = cache.get(url);
  if (known) return known;
  try {
    const facts = await read(url);
    if (facts) {
      if (cache.size >= CACHE_LIMIT) cache.clear();
      cache.set(url, facts);
    }
    return facts;
  } catch {
    return null;
  }
};
