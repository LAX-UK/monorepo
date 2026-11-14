import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
  PUBLIC_ITEM_READ_CACHE_CONTROL,
  createPublicCacheControlMiddleware,
} from "./public-cache-control.js";

const LOT = "0b8f0c1e-7c39-4a1c-9d1f-1f0f6a2b3c4d";
const SALE = "11111111-1111-4111-8111-111111111111";
const LIST = "public, s-maxage=30, stale-while-revalidate=60";

function app(userId?: string) {
  const a = new Hono<{ Variables: { userId?: string } }>();
  a.use("*", async (c, next) => {
    if (userId) c.set("userId", userId);
    await next();
  });
  a.use("*", createPublicCacheControlMiddleware({ sMaxAge: 30, staleWhileRevalidate: 60 }));
  a.get("*", (c) => (c.req.path.endsWith("/missing") ? c.notFound() : c.json({ ok: true })));
  return a;
}

async function cacheControl(path: string, userId?: string) {
  const res = await app(userId).request(path);
  return res.headers.get("Cache-Control");
}

describe("public cache headers", () => {
  it.each([
    `/lots/${LOT}`,
    `/lots/${LOT}/bids`,
    `/lots/${LOT}/bid-history`,
    `/lots/${LOT}/watch-count`,
    `/lots/${LOT}/documents`,
    `/sales/${SALE}`,
    `/sales/${SALE}/lots`,
    `/sales/${SALE}/bidders`,
  ])("lets no CDN answer %s from a copy, so a purge holds", async (path) => {
    const value = await cacheControl(path);
    expect(value).toBe(PUBLIC_ITEM_READ_CACHE_CONTROL);
    expect(value).not.toMatch(/s-maxage=[1-9]|stale-while-revalidate/);
  });

  it.each(["/lots", "/sales", "/press"])(
    "keeps the short CDN window on the list %s",
    async (path) => {
      expect(await cacheControl(path)).toBe(LIST);
    },
  );

  it("sets nothing for a signed-in caller or an error", async () => {
    expect(await cacheControl(`/lots/${LOT}`, "user-1")).toBeNull();
    expect(await cacheControl(`/lots/${LOT}/missing`)).toBeNull();
  });
});
