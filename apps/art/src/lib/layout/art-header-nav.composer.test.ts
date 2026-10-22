import { artistSummary, fakeArtServices } from "@/lib/testing/fake-art-services";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ART_HEADER_NAV_ARTIST_LIMIT, composeArtHeaderNav } from "./art-header-nav.composer.js";

describe("composeArtHeaderNav", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("maps featured artists and stocked object types", async () => {
    const { catalogue } = fakeArtServices();
    catalogue.listArtists.mockResolvedValue({
      items: [artistSummary({ slug: "frida", name: "Frida", portraitUrl: "https://cdn/f.jpg" })],
    });
    catalogue.listArtworkObjectTypes.mockResolvedValue({
      items: [
        { objectType: "painting", artworkCount: 4, coverImageUrl: null },
        { objectType: "sculpture", artworkCount: 1, coverImageUrl: null },
      ],
    });

    await expect(composeArtHeaderNav(catalogue)).resolves.toEqual({
      artists: [{ name: "Frida", href: "/artists/frida", imageUrl: "https://cdn/f.jpg" }],
      objectTypes: ["painting", "sculpture"],
    });
    expect(catalogue.listArtists).toHaveBeenCalledTimes(1);
    expect(catalogue.listArtists).toHaveBeenCalledWith({
      limit: ART_HEADER_NAV_ARTIST_LIMIT,
      placement: "featured_artists",
    });
  });

  it("falls back to the newest artists when the featured placement is empty", async () => {
    const { catalogue } = fakeArtServices();
    catalogue.listArtists.mockImplementation(async (query) => ({
      items: query.placement ? [] : [artistSummary()],
    }));

    const nav = await composeArtHeaderNav(catalogue);

    expect(catalogue.listArtists).toHaveBeenLastCalledWith({ limit: ART_HEADER_NAV_ARTIST_LIMIT });
    expect(nav?.artists.map((artist) => artist.name)).toEqual(["Flora Powers"]);
  });

  it("returns null when a read fails", async () => {
    const { catalogue } = fakeArtServices();
    catalogue.listArtworkObjectTypes.mockRejectedValue(new Error("upstream"));

    await expect(composeArtHeaderNav(catalogue)).resolves.toBeNull();
  });

  it("returns null instead of waiting on a slow catalogue", async () => {
    vi.useFakeTimers();
    const { catalogue } = fakeArtServices();
    catalogue.listArtists.mockReturnValue(new Promise(() => {}));

    const pending = composeArtHeaderNav(catalogue, 500);
    await vi.advanceTimersByTimeAsync(500);

    await expect(pending).resolves.toBeNull();
  });
});
