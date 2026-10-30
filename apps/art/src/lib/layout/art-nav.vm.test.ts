import { describe, expect, it } from "vitest";
import {
  type ArtHeaderNavData,
  buildArtMegaNavSections,
  buildArtMobileNavItems,
  buildArtNavItems,
  buildArtSearchSuggestions,
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
      "Collecting",
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

  describe("desktop mega nav", () => {
    const DATA: ArtHeaderNavData = {
      artists: [
        { name: "Frida Kahlo", href: "/artists/frida", imageUrl: "https://cdn/frida.jpg" },
        { name: "No Portrait", href: "/artists/none", imageUrl: null },
      ],
      objectTypes: ["painting", "work_on_paper"],
    };

    it("renders every item as a plain link without catalogue data", () => {
      const sections = buildArtMegaNavSections(null);
      expect(sections.map((section) => [section.label, section.linkHref])).toEqual([
        ["Artists", "/artists"],
        ["Artworks", "/artworks"],
        ["Exhibitions", "/exhibitions"],
        ["Art Hub", "/art-hub"],
        ["Collecting", "/collector-hub"],
      ]);
      expect(buildArtSearchSuggestions(null)).toEqual([]);
    });

    it("lists featured artists with their portrait as featured media", () => {
      const [artists] = buildArtMegaNavSections(DATA);
      expect(artists?.linkHref).toBeUndefined();
      expect(artists?.viewAllHref).toBe("/artists");
      expect(artists?.items).toEqual([
        {
          href: "/artists/frida",
          label: "Frida Kahlo",
          media: {
            src: "https://cdn/frida.jpg",
            alt: "Portrait of Frida Kahlo",
            caption: "Frida Kahlo",
          },
        },
        { href: "/artists/none", label: "No Portrait" },
      ]);
    });

    it("builds artwork columns from stocked media only: every work on lax.art is an original", () => {
      const artworks = buildArtMegaNavSections(DATA)[1];
      expect(artworks?.columns).toEqual([
        {
          id: "medium",
          title: "By medium",
          items: [
            { href: "/paintings", label: "Paintings" },
            { href: "/artworks?objectType=work_on_paper", label: "Works on paper" },
          ],
        },
      ]);
      const withoutStock = buildArtMegaNavSections({ ...DATA, objectTypes: [] })[1];
      expect(withoutStock).toMatchObject({ linkHref: "/artworks", items: [] });
      expect(withoutStock?.columns).toBeUndefined();
    });

    it("links exhibitions by status and keeps the hubs as plain links", () => {
      const sections = buildArtMegaNavSections(DATA);
      expect(sections[2]?.items.map((item) => item.href)).toEqual([
        "/exhibitions",
        "/exhibitions?status=upcoming",
        "/exhibitions?status=past",
      ]);
      expect(sections.slice(3).map((section) => section.linkHref)).toEqual([
        "/art-hub",
        "/collector-hub",
      ]);
    });

    it("plain-links Artists when no artists are listed", () => {
      expect(buildArtMegaNavSections({ ...DATA, artists: [] })[0]?.linkHref).toBe("/artists");
    });

    it("suggests the featured artists in header search", () => {
      expect(buildArtSearchSuggestions(DATA)).toEqual([
        { label: "Frida Kahlo", href: "/artists/frida" },
        { label: "No Portrait", href: "/artists/none" },
      ]);
    });
  });
});
