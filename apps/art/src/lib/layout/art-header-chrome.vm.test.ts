import { describe, expect, it } from "vitest";
import { artRouteMayHaveHero } from "./art-header-chrome.vm.js";

describe("artRouteMayHaveHero", () => {
  it.each(["/", "/paintings", "/prints", "/sculptures"])("allows %s", (pathname) => {
    expect(artRouteMayHaveHero(pathname)).toBe(true);
  });

  it.each([
    "/artists/flora-powers",
    "/exhibitions/spring-show",
    "/stories/collecting-101",
    "/visit/marylebone",
  ])("allows the detail page %s", (pathname) => {
    expect(artRouteMayHaveHero(pathname)).toBe(true);
  });

  it.each([
    "/artists",
    "/exhibitions",
    "/artworks",
    "/artworks/warm-basket",
    "/art-hub",
    "/collector-hub",
    "/search",
    "/account/favourites",
    "/login",
    "/artists/",
  ])("keeps the header solid on %s", (pathname) => {
    expect(artRouteMayHaveHero(pathname)).toBe(false);
  });
});
