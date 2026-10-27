import { describe, expect, it, vi } from "vitest";
import { absoluteSeedAssetUrl, withAbsoluteSeedAssetUrls } from "./seed-asset-urls.js";

const origins = { shop: "https://test-shop.lax.art/", art: "https://test.lax.art" };

describe("absoluteSeedAssetUrl", () => {
  it("prefixes each path with the origin that serves it", () => {
    expect(absoluteSeedAssetUrl("/shop/home/a.webp", origins)).toBe(
      "https://test-shop.lax.art/shop/home/a.webp",
    );
    expect(absoluteSeedAssetUrl("/art/seed/b.webp", origins)).toBe(
      "https://test.lax.art/art/seed/b.webp",
    );
  });

  it("leaves absolute URLs, storage keys, empty values and unconfigured origins alone", () => {
    expect(absoluteSeedAssetUrl("https://x.test/a.jpg", origins)).toBe("https://x.test/a.jpg");
    expect(absoluteSeedAssetUrl("uploads/a.jpg", origins)).toBe("uploads/a.jpg");
    expect(absoluteSeedAssetUrl(null, origins)).toBeNull();
    expect(absoluteSeedAssetUrl("/art/seed/b.webp", { ...origins, art: undefined })).toBe(
      "/art/seed/b.webp",
    );
  });
});

describe("withAbsoluteSeedAssetUrls", () => {
  it("rewrites the image and portrait of every imported artwork", async () => {
    const inner = vi.fn().mockResolvedValue({});
    await withAbsoluteSeedAssetUrls(
      inner,
      origins,
    )({
      primaryImageUrl: "/art/seed/b.webp",
      artistPortraitUrl: "/shop/home/p.webp",
    } as never);
    expect(inner).toHaveBeenCalledWith(
      expect.objectContaining({
        primaryImageUrl: "https://test.lax.art/art/seed/b.webp",
        artistPortraitUrl: "https://test-shop.lax.art/shop/home/p.webp",
      }),
    );
  });
});
