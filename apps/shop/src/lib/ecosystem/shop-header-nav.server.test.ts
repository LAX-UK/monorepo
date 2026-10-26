import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/shop-api.server", () => ({
  fetchPublicArtists: vi.fn(),
  fetchPublicCategories: vi.fn(),
}));

const { composeShopHeaderNav } = await import("./shop-header-nav.server");

const artist = (slug: string, artworkCount: number) => ({
  slug,
  name: slug,
  discipline: null,
  portraitUrl: null,
  artworkCount,
});

describe("composeShopHeaderNav", () => {
  it("falls back to artists by name when none are featured, keeping only those with editions", async () => {
    const listArtists = vi
      .fn()
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [artist("emmett-king", 2), artist("no-editions", 0)] });
    const listCategories = vi.fn().mockResolvedValue({
      items: [
        { slug: "screenprints", label: "Screenprints", imageUrl: null, artworkCount: 2 },
        { slug: "empty", label: "Empty", imageUrl: null, artworkCount: 0 },
      ],
    });
    const nav = await composeShopHeaderNav({ listArtists, listCategories });
    expect(listArtists).toHaveBeenLastCalledWith({ limit: 6, sort: "nameAsc" });
    expect(nav).toEqual({
      artists: [{ name: "emmett-king", href: "/artists/emmett-king", imageUrl: null }],
      categories: [{ label: "Screenprints", href: "/categories/screenprints" }],
    });
  });

  it("returns null on failure or when the catalogue is slow", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("down"));
    expect(
      await composeShopHeaderNav({ listArtists: failing, listCategories: failing }),
    ).toBeNull();

    const slow = () => new Promise<never>(() => {});
    expect(await composeShopHeaderNav({ listArtists: slow, listCategories: slow }, 10)).toBeNull();
  });
});
