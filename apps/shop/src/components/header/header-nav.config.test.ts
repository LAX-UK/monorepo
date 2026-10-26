import { describe, expect, it } from "vitest";
import { buildShopMegaMenuSections } from "./header-nav.config";

const artists = ["Emmett King", "Juno Frost", "Elias Moore"].map((name) => ({
  name,
  href: `/artists/${name.toLowerCase().replace(" ", "-")}`,
  imageUrl: null,
}));

describe("buildShopMegaMenuSections", () => {
  it("names what Shop sells: Editions and Artists, with Merchandise only when it is on", () => {
    expect(buildShopMegaMenuSections(false).map((section) => section.label)).toEqual([
      "Editions",
      "Artists",
    ]);
    expect(buildShopMegaMenuSections(true).map((section) => section.label)).toEqual([
      "Editions",
      "Artists",
      "Merchandise",
    ]);
  });

  it("gives Editions browse links and the categories that hold editions", () => {
    const [editions] = buildShopMegaMenuSections(false, {
      artists: [],
      categories: [{ label: "Screenprints", href: "/categories/screenprints" }],
    });
    expect(editions?.columns?.map((column) => column.title)).toEqual(["Browse", "Categories"]);
    expect(editions?.columns?.[0]?.items.map((item) => item.label)).toEqual([
      "All editions",
      "Available now",
      "All categories",
    ]);
    expect(editions?.items.map((item) => item.label)).toContain("Screenprints");
  });

  it("opens an Artists panel only with three or more artists, otherwise links straight to them", () => {
    const withArtists = buildShopMegaMenuSections(false, { artists, categories: [] })[1];
    expect(withArtists?.linkHref).toBeUndefined();
    expect(withArtists?.items.map((item) => item.label)).toEqual([
      "Emmett King",
      "Juno Frost",
      "Elias Moore",
    ]);

    const fallback = buildShopMegaMenuSections(false, null)[1];
    expect(fallback?.linkHref).toBe("/artists");
  });
});
