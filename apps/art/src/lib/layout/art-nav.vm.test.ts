import { describe, expect, it } from "vitest";
import {
  buildArtMobileNavItems,
  buildArtNavItems,
  resolveArtMobileNavKey,
  resolveArtNavKey,
} from "./art-nav.vm.js";

describe("art navigation view model", () => {
  it.each([
    ["/artists", "artists"],
    ["/artists/flora-powers", "artists"],
    ["/artworks", "artworks"],
    ["/artworks/warm-basket", "artworks"],
    ["/exhibitions", "exhibitions"],
    ["/exhibitions/spring-show", "exhibitions"],
    ["/art-hub", "artHub"],
    ["/collector-hub", "collectorHub"],
    ["/search", null],
    ["/account/favourites", null],
  ] as const)("maps %s to %s", (pathname, key) => {
    expect(resolveArtNavKey(pathname)).toBe(key);
  });

  it("builds primary header nav labels", () => {
    expect(buildArtNavItems("/exhibitions").map((item) => item.label)).toEqual([
      "Artists",
      "Artworks",
      "Exhibitions",
      "Art Hub",
      "Collector Hub",
    ]);
    expect(
      buildArtNavItems("/exhibitions")
        .filter((item) => item.active)
        .map((item) => item.key),
    ).toEqual(["exhibitions"]);
  });

  it.each([
    ["/", "home"],
    ["/artworks", "discover"],
    ["/artists/flora-powers", "discover"],
    ["/search", "discover"],
    ["/account/favourites", "favorites"],
    ["/account/enquiries", "account"],
    ["/account", "account"],
    ["/accounting", null],
    ["/login", "account"],
    ["/signed-out", "account"],
    ["/session-expired", "account"],
    ["/exhibitions", null],
  ] as const)("maps mobile %s to %s", (pathname, key) => {
    expect(resolveArtMobileNavKey(pathname)).toBe(key);
  });

  it("builds the Home, Discover, Favorites, Account tab bar with one active tab", () => {
    const mobile = buildArtMobileNavItems("/account/favourites");
    expect(mobile.map(({ label, href }) => [label, href])).toEqual([
      ["Home", "/"],
      ["Discover", "/artworks"],
      ["Favourites", "/account/favourites"],
      ["Account", "/account"],
    ]);
    expect(mobile.filter((item) => item.active).map((item) => item.key)).toEqual(["favorites"]);
  });
});
