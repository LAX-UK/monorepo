import { describe, expect, it, vi } from "vitest";
import { createHttpArtCacheInvalidator } from "./http-art-cache-invalidator.js";

const config = { url: "https://art.example/api/revalidate", secret: "s".repeat(32) };

describe("createHttpArtCacheInvalidator", () => {
  it("posts the editorial tag with the shared secret", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    await createHttpArtCacheInvalidator({ ...config, fetchImpl }).invalidateEditorial();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(config.url);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["x-revalidate-secret"]).toBe(config.secret);
    expect(JSON.parse(init.body as string)).toEqual({ tags: ["art:editorial"] });
  });

  it("retries once after a failure and then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await createHttpArtCacheInvalidator({
      ...config,
      fetchImpl,
      retryDelayMs: 0,
    }).invalidateEditorial();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("rejects after the retry is exhausted", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 401 }));
    await expect(
      createHttpArtCacheInvalidator({
        ...config,
        fetchImpl,
        retryDelayMs: 0,
      }).invalidateEditorial(),
    ).rejects.toThrow("401");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("rejects when the network call throws", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    await expect(
      createHttpArtCacheInvalidator({
        ...config,
        fetchImpl,
        retryDelayMs: 0,
      }).invalidateEditorial(),
    ).rejects.toThrow("ECONNREFUSED");
  });
});
