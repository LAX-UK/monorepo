import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ART_SLUG_LOOKUP,
  artSlugReadInit,
  fetchArtChannelArtistBySlug,
} from "./art-catalogue.server";

describe("artist detail reads", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("bypass the data cache by default, and are cached and tagged for a prerendered page", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchArtChannelArtistBySlug("flora-powers");
    await fetchArtChannelArtistBySlug("flora-powers", "cached");

    const [fresh, cached] = fetchMock.mock.calls.map(
      (call) => (call as unknown[])[1] as RequestInit,
    );
    expect(fresh).toMatchObject({ cache: "no-store" });
    expect(cached).toMatchObject({
      next: { revalidate: 300, tags: ["art:catalogue", "art:artists"] },
    });
    expect(cached?.cache).toBeUndefined();
  });

  it("maps the read mode to its fetch options", () => {
    expect(artSlugReadInit("fresh")).toBe(ART_SLUG_LOOKUP);
    expect(artSlugReadInit("cached")).toBeUndefined();
  });
});
