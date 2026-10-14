import { describe, expect, it } from "vitest";
import { createFakeObjectStorage } from "../test-support/fake-object-storage.js";
import { resolveShopMediaPublicUrl } from "./resolve-shop-media-url.js";

describe("resolveShopMediaPublicUrl", () => {
  const storage = createFakeObjectStorage("https://cdn.test");

  it("returns null for blank values", () => {
    expect(resolveShopMediaPublicUrl(storage, "  ")).toBeNull();
    expect(resolveShopMediaPublicUrl(storage, null)).toBeNull();
  });

  it("maps storage keys to the media origin", () => {
    expect(resolveShopMediaPublicUrl(storage, "shop/artwork/a.webp")).toBe(
      "https://cdn.test/shop/artwork/a.webp",
    );
  });

  it("keeps absolute URLs", () => {
    expect(resolveShopMediaPublicUrl(storage, "https://cdn.test/shop/artwork/a.webp")).toBe(
      "https://cdn.test/shop/artwork/a.webp",
    );
  });

  it("keeps root-relative storefront assets when storage is configured", () => {
    expect(resolveShopMediaPublicUrl(storage, "/art/seed/hero-layer-1.webp")).toBe(
      "/art/seed/hero-layer-1.webp",
    );
  });

  it("serves keys root-relative when storage is off", () => {
    expect(resolveShopMediaPublicUrl(null, "shop/artwork/a.webp")).toBe("/shop/artwork/a.webp");
    expect(resolveShopMediaPublicUrl(null, "/art/seed/a.webp")).toBe("/art/seed/a.webp");
  });
});
