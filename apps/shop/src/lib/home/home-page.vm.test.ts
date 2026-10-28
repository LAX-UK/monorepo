import { artworkSummary } from "@/test/artwork-summary.fixture";
import type { PublicArtistSummary, PublicArtworkSummary } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import type { HomePageComposerResult } from "./home-page.composer";
import {
  type HomePageContext,
  buildHomePageViewModel,
  buildShopProductDoors,
  heroLead,
} from "./home-page.vm";

const NOW = new Date("2026-10-28T12:00:00.000Z");
const OLD = "2026-01-01T00:00:00.000Z";

const art = {
  id: "art" as const,
  label: "lax.art",
  href: "https://art.test",
  current: false,
  external: true,
};

const context: HomePageContext = {
  now: NOW,
  artBaseUrl: new URL("https://art.test"),
  productLinks: [],
  linkablePolicies: ["help", "delivery", "returns"],
  deliveryTimes: { ukDelivery: { min: 3, max: 5 }, collection: { min: 2, max: 2 } },
};

const empty: HomePageComposerResult = {
  featured: [],
  editions: [],
  availableCount: null,
  lowestPricePence: null,
  facets: null,
  priceBands: [],
  priceRanges: [],
  categoryCovers: {},
  artists: [],
  artistCount: null,
  soloArtist: null,
  sectionErrors: {},
};

const editions = (count: number): PublicArtworkSummary[] =>
  Array.from({ length: count }, (_, index) =>
    artworkSummary({ slug: `edition-${index + 1}`, title: `Edition ${index + 1}`, listedAt: OLD }),
  );

const artist = (slug: string): PublicArtistSummary => ({
  slug,
  name: slug,
  discipline: null,
  portraitUrl: null,
  artworkCount: 2,
});

function build(overrides: Partial<HomePageComposerResult> = {}, ctx = context) {
  return buildHomePageViewModel({ ...empty, ...overrides }, ctx);
}

describe("home hero", () => {
  it("leads with the featured release on sale, and names it beside the primary action", () => {
    const soldOut = artworkSummary({
      slug: "sold",
      availability: { totalEditions: 10, state: "sold_out" },
    });
    const live = artworkSummary({ slug: "live", title: "Harbour light", yearCreated: 2026 });
    const hero = build({ featured: [soldOut, live], availableCount: 1 }).hero;
    expect(hero.title).toBe("Limited-edition prints from our Marylebone gallery");
    expect(hero.eyebrow).toBe("New release · 1 Oct 2026");
    expect(hero.workLink).toEqual({ label: "See Harbour light", href: "/artworks/live" });
    expect(hero.release).toMatchObject({
      href: "/artworks/live",
      line: "Now released: Harbour light, 2026 · £340",
    });
  });

  it("gives no eyebrow to an older edition chosen by the rule", () => {
    const hero = build({ editions: [artworkSummary({ listedAt: OLD })], availableCount: 1 }).hero;
    expect(hero.eyebrow).toBeNull();
    expect(hero.release?.href).toBe("/artworks/harbour-light");
  });

  it("still names what Shop sells when no release has an image", () => {
    const hero = build({ editions: [artworkSummary({ imageUrl: null })], availableCount: 1 }).hero;
    expect(hero.release).toBeNull();
    expect(hero.workLink).toBeNull();
    expect(hero.primary).toEqual({ label: "Browse editions", href: "/artworks" });
  });

  it("names up to two artists, then counts them, and gives the lowest price", () => {
    expect(
      heroLead({ artistNames: ["Flora Powers"], artistCount: 1, lowestPricePence: 4200 }),
    ).toBe("Editions by Flora Powers, from £42. Prices include VAT.");
    expect(heroLead({ artistNames: ["A", "B"], artistCount: 2, lowestPricePence: null })).toBe(
      "Editions by A and B. Prices include VAT.",
    );
    expect(
      heroLead({ artistNames: ["A", "B", "C"], artistCount: 12, lowestPricePence: 9500 }),
    ).toBe("Editions by 12 gallery artists, from £95. Prices include VAT.");
    expect(heroLead({ artistNames: [], artistCount: null, lowestPricePence: null })).toBe(
      "Editions by the gallery’s artists. Prices include VAT.",
    );
  });

  it("makes no claim about signing or numbering", () => {
    const vm = build({ editions: editions(3), availableCount: 3, artists: [artist("a")] });
    const words = `${vm.hero.eyebrow} ${vm.hero.title} ${vm.hero.lead}`.toLowerCase();
    expect(words).not.toMatch(/sign|number/);
  });
});

describe("with nothing on sale", () => {
  const soldOutFacets = {
    availability: { available: 0, soldOut: 4 },
    categories: [],
    artists: [],
  };

  it("says new editions are on their way and keeps only the doors and the gallery team", () => {
    const vm = build(
      { availableCount: 0, facets: soldOutFacets, artists: [artist("a")] },
      { ...context, productLinks: [art] },
    );
    expect(vm.hero).toMatchObject({
      title: "New editions are on their way",
      primary: null,
      release: null,
      browseRows: [],
      emptyAction: { label: "See original works on lax.art", href: "https://art.test" },
    });
    expect(vm.hero.lead).toMatch(/^Every edition has found a home/);
    expect(vm.layout.sections).toEqual(["hero", "product-doors", "gallery-team"]);
  });

  it("does not claim the Shop is empty when the editions read failed", () => {
    const vm = build({ sectionErrors: { editions: "down" } });
    expect(vm.hero.title).toBe("Limited-edition prints from our Marylebone gallery");
    expect(vm.layout.sections).toContain("new-editions");
  });
});

describe("new editions", () => {
  it("leaves out the release already in the first screen", () => {
    const vm = build({ editions: editions(6), availableCount: 12 });
    expect(vm.newEditions?.items.map((item) => item.slug)).toEqual([
      "edition-2",
      "edition-3",
      "edition-4",
      "edition-5",
    ]);
    expect(vm.newEditions?.viewAll.label).toBe("View all 12 editions");
  });

  it("is hidden when the release is the only edition on sale", () => {
    const vm = build({ editions: editions(1), availableCount: 1 });
    expect(vm.newEditions).toBeNull();
    expect(vm.layout.sections).not.toContain("new-editions");
  });
});

describe("artists", () => {
  it("shows a single artist rather than hiding the section below three", () => {
    const vm = build({ editions: editions(2), availableCount: 2, artists: [artist("a")] });
    expect(vm.artists?.layout).toBe("feature");
    expect(vm.layout.sections).toContain("artists");
  });
});

describe("the home page's band sequence", () => {
  it("lists every section with content in page order, the product doors before the gallery team", () => {
    const vm = build(
      { editions: editions(5), availableCount: 5, artists: [artist("a"), artist("b")] },
      { ...context, productLinks: [art] },
    );
    expect(vm.layout.sections).toEqual([
      "hero",
      "trust",
      "new-editions",
      "artists",
      "product-doors",
      "gallery-team",
    ]);
    expect(vm.layout.surfaces.hero).toBe("plain");
    expect(vm.layout.surfaces["gallery-team"]).toBe("band");
    expect(vm.galleryTeam.title).toBe("Help choosing a size, a frame or a gift");
  });
});

describe("product doors", () => {
  it("opens lax.art first, then LAX Bid, and leaves out a product without a link", () => {
    const bid = { ...art, id: "bid" as const, label: "LAX Bid", href: "https://bid.test" };
    expect(buildShopProductDoors([bid, art]).map((door) => [door.product, door.href])).toEqual([
      ["art", "https://art.test"],
      ["bid", "https://bid.test"],
    ]);
    expect(buildShopProductDoors([bid]).map((door) => door.product)).toEqual(["bid"]);
  });
});
