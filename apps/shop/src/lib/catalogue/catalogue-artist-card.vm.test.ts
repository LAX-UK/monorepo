import { describe, expect, it } from "vitest";
import { buildCatalogueArtistCards, chooseArtistTileImage } from "./catalogue-artist-card.vm";

const artist = (over: Record<string, unknown> = {}) => ({
  slug: "flora-powers",
  name: "Flora Powers",
  discipline: "Printmaker",
  portraitUrl: null,
  artworkCount: 3,
  ...over,
});

describe("chooseArtistTileImage", () => {
  it("uses the portrait when there is one, even beside a lead edition image", () => {
    expect(chooseArtistTileImage({ portraitUrl: "/p.jpg", leadImageUrl: "/w.jpg" })).toEqual({
      kind: "portrait",
      src: "/p.jpg",
    });
  });

  it("uses the lead edition image when there is no portrait", () => {
    expect(chooseArtistTileImage({ portraitUrl: null, leadImageUrl: "/w.jpg" })).toEqual({
      kind: "work",
      src: "/w.jpg",
    });
    expect(chooseArtistTileImage({ portraitUrl: "  ", leadImageUrl: "/w.jpg" }).kind).toBe("work");
  });

  it("falls to initials only when neither image exists", () => {
    expect(chooseArtistTileImage({ portraitUrl: null })).toEqual({ kind: "initials" });
    expect(chooseArtistTileImage({ portraitUrl: null, leadImageUrl: null })).toEqual({
      kind: "initials",
    });
  });
});

describe("buildCatalogueArtistCards", () => {
  it("carries the portrait or the work image, never both", () => {
    const [withPortrait, withWork, bare] = buildCatalogueArtistCards([
      artist({ portraitUrl: "/p.jpg", leadImageUrl: "/w.jpg" }),
      artist({ slug: "b", leadImageUrl: "/w.jpg" }),
      artist({ slug: "c" }),
    ]);
    expect([withPortrait?.image, withPortrait?.workImage]).toEqual(["/p.jpg", null]);
    expect([withWork?.image, withWork?.workImage]).toEqual([null, "/w.jpg"]);
    expect([bare?.image, bare?.workImage]).toEqual([null, null]);
  });
});
