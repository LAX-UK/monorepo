import { describe, expect, it } from "vitest";
import { buildArtNavItems, resolveArtNavKey } from "./art-nav.vm.js";

describe("art navigation view model", () => {
  it.each([
    ["/", "home"],
    ["/artworks", "artworks"],
    ["/artworks/warm-basket", "artworks"],
    ["/artists/flora-powers", "artworks"],
    ["/search", "search"],
    ["/account/favorites", "account"],
    ["/login", "account"],
    ["/artworksx", null],
    ["/health/live", null],
  ] as const)("maps %s to %s", (pathname, key) => {
    expect(resolveArtNavKey(pathname)).toBe(key);
  });

  it("omits Home from the desktop header and keeps it on mobile", () => {
    expect(buildArtNavItems("/search", { includeHome: false }).map((item) => item.label)).toEqual([
      "Artworks",
      "Search",
      "Account",
    ]);
    const mobile = buildArtNavItems("/search", { includeHome: true });
    expect(mobile).toHaveLength(4);
    expect(mobile.filter((item) => item.active).map((item) => item.key)).toEqual(["search"]);
  });
});
