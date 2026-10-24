import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveOriginalArtworkUrl } from "./original-artwork-url.server";

const mocks = vi.hoisted(() => ({
  fetchPublicArtworkBySlug: vi.fn(),
  loadShopArtBaseUrl: vi.fn(),
}));

vi.mock("@/lib/shop-api.server", () => ({
  fetchPublicArtworkBySlug: mocks.fetchPublicArtworkBySlug,
}));
vi.mock("@/lib/ecosystem/product-directory.server", () => ({
  loadShopArtBaseUrl: mocks.loadShopArtBaseUrl,
}));

describe("resolveOriginalArtworkUrl", () => {
  beforeEach(() => {
    mocks.fetchPublicArtworkBySlug.mockReset();
    mocks.loadShopArtBaseUrl.mockReset();
    mocks.loadShopArtBaseUrl.mockReturnValue(new URL("https://art.example.test"));
  });

  it("points an original at its lax.art page", async () => {
    mocks.fetchPublicArtworkBySlug.mockResolvedValue({ slug: "string-study" });
    await expect(resolveOriginalArtworkUrl("string-study")).resolves.toBe(
      "https://art.example.test/artworks/string-study",
    );
    expect(mocks.fetchPublicArtworkBySlug).toHaveBeenCalledWith("string-study", "art");
  });

  it("returns null for a slug that is not on lax.art", async () => {
    mocks.fetchPublicArtworkBySlug.mockResolvedValue(null);
    await expect(resolveOriginalArtworkUrl("missing")).resolves.toBeNull();
  });

  it("returns null when the lookup fails or lax.art is not configured", async () => {
    mocks.fetchPublicArtworkBySlug.mockRejectedValue(new Error("offline"));
    await expect(resolveOriginalArtworkUrl("string-study")).resolves.toBeNull();
    mocks.loadShopArtBaseUrl.mockReturnValue(null);
    await expect(resolveOriginalArtworkUrl("string-study")).resolves.toBeNull();
  });
});
