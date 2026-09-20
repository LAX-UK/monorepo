import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShopApiBffError } from "./shop-api-bff-error.js";
import { fetchPublicArtworkCatalogue, shopApiBaseUrl } from "./shop-api.server.js";

describe("shopApiBaseUrl", () => {
  afterEach(() => {
    // biome-ignore lint/performance/noDelete: assigning undefined stores the string "undefined".
    delete process.env.SHOP_API_BASE_URL;
  });

  it("defaults to local shop-api", () => {
    expect(shopApiBaseUrl()).toBe("http://localhost:3011");
  });

  it("strips trailing slashes", () => {
    process.env.SHOP_API_BASE_URL = "http://shop-api:3011/";
    expect(shopApiBaseUrl()).toBe("http://shop-api:3011");
  });
});

describe("fetchPublicArtworkCatalogue", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws when catalogue request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503 }) as Response),
    );
    await expect(fetchPublicArtworkCatalogue()).rejects.toMatchObject({
      kind: "upstream",
      message: expect.stringMatching(/503/),
    });
  });

  it("rejects malformed JSON before it reaches view models", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not-json", { status: 200 })),
    );

    await expect(fetchPublicArtworkCatalogue()).rejects.toEqual(
      expect.objectContaining<Partial<ShopApiBffError>>({
        name: "ShopApiBffError",
        kind: "malformed",
      }),
    );
  });

  it("rejects JSON that violates the public contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ items: [{ slug: "missing-required-fields" }] })),
    );

    await expect(fetchPublicArtworkCatalogue()).rejects.toMatchObject({
      kind: "malformed",
    });
  });
});
