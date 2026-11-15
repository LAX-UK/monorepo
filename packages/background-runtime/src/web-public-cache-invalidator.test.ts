import { describe, expect, it, vi } from "vitest";
import {
  WebRevalidateRejectedError,
  createHttpWebPublicCacheInvalidator,
  isPermanentRevalidateFailure,
  noopWebPublicCacheInvalidator,
  webPublicCacheInvalidatorFromEnv,
} from "./web-public-cache-invalidator.js";

describe("createHttpWebPublicCacheInvalidator", () => {
  it("posts the de-duplicated tags with the shared secret", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const inv = createHttpWebPublicCacheInvalidator({
      url: "http://web:3000/api/revalidate",
      secret: "s3cret",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await inv.invalidate(["public-lot:a", "public-lot:a", "public-sale:b"]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://web:3000/api/revalidate");
    expect((init.headers as Record<string, string>)["x-revalidate-secret"]).toBe("s3cret");
    expect(JSON.parse(String(init.body))).toEqual({ tags: ["public-lot:a", "public-sale:b"] });
  });

  it("retries once, then throws", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 500 }));
    const inv = createHttpWebPublicCacheInvalidator({
      url: "http://web/api/revalidate",
      secret: "s",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retryDelayMs: 0,
    });
    await expect(inv.invalidate(["public-lot:a"])).rejects.toThrow(/500/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([400, 401, 404])("does not retry a %i, and marks it permanent", async (status) => {
    const fetchImpl = vi.fn(async () => new Response(null, { status }));
    const inv = createHttpWebPublicCacheInvalidator({
      url: "http://web/api/revalidate",
      secret: "s",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retryDelayMs: 0,
    });
    const err = await inv.invalidate(["public-lot:a"]).catch((e: unknown) => e);
    expect(isPermanentRevalidateFailure(err)).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([408, 429, 500, 503])("treats a %i as transient", (status) => {
    expect(isPermanentRevalidateFailure(new WebRevalidateRejectedError(status))).toBe(false);
  });

  it("treats a network failure as transient", () => {
    expect(isPermanentRevalidateFailure(new TypeError("fetch failed"))).toBe(false);
  });

  it("is a no-op while not configured", () => {
    expect(webPublicCacheInvalidatorFromEnv({})).toBe(noopWebPublicCacheInvalidator);
    expect(webPublicCacheInvalidatorFromEnv({ WEB_REVALIDATE_URL: "http://web" })).toBe(
      noopWebPublicCacheInvalidator,
    );
  });
});
