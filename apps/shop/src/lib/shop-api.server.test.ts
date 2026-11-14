import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShopApiBffError } from "./shop-api-bff-error.js";
import {
  fetchPublicArtworkBySlug,
  fetchPublicArtworkCatalogue,
  fetchPublicCategories,
  fetchPublicCategoryBySlug,
  shopApiBaseUrl,
} from "./shop-api.server.js";

// The detail parser is covered by the contracts package; here only the fetch path matters.
vi.mock("@auction/shop-contracts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@auction/shop-contracts")>()),
  parsePublicArtworkDetail: (value: unknown) => value,
}));

describe("fetchPublicCategories", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks for Shop-channel categories only, with and without a placement", async () => {
    const fetchMock = vi.fn(async () => Response.json({ items: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchPublicCategories({ limit: 12 });
    await fetchPublicCategories({ placement: "featured_categories" });

    const urls = fetchMock.mock.calls.map((call) => new URL((call as unknown as [string])[0]));
    expect(urls.map((url) => url.pathname)).toEqual(["/v1/categories", "/v1/categories"]);
    expect(urls.map((url) => url.searchParams.get("salesChannel"))).toEqual(["shop", "shop"]);
    expect(urls[0]?.searchParams.get("limit")).toBe("12");
    expect(urls[1]?.searchParams.get("placement")).toBe("featured_categories");
  });
});

describe("fetchPublicCategoryBySlug", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("bypasses the data cache so a deleted category returns not found", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPublicCategoryBySlug("watches")).resolves.toBeNull();
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.cache).toBe("no-store");
    expect(init).not.toHaveProperty("next");
  });
});

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

describe("fetchPublicArtworkBySlug", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const artwork = { slug: "vessel-study" };

  it("asks again when the first request times out, so a cold API does not show the error page", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(
        new DOMException("The operation was aborted due to timeout", "TimeoutError"),
      )
      .mockResolvedValueOnce(Response.json(artwork));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPublicArtworkBySlug("vessel-study")).resolves.toEqual(artwork);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of fetchMock.mock.calls) {
      const init = (call as unknown as [string, RequestInit])[1];
      expect(init.cache).toBe("no-store");
      expect(init).not.toHaveProperty("next");
    }
  });

  it("asks again after a gateway error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json(artwork));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPublicArtworkBySlug("vessel-study")).resolves.toEqual(artwork);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns not found on a 404 without asking again", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPublicArtworkBySlug("missing")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still fails when the second request fails too", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPublicArtworkBySlug("vessel-study")).rejects.toMatchObject({
      name: "ShopApiBffError",
      kind: "upstream",
    } satisfies Partial<ShopApiBffError>);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
