import { artworkSummary } from "@/test/artwork-summary.fixture";
import type { PublicArtistSummary, PublicArtworkSummary } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import type { HomePageComposerResult } from "./home-page.composer";
import {
  type HomePageContext,
  buildHomePageViewModel,
  buildShopProductDoors,
  heroLead,
  selectHomeRelease,
} from "./home-page.vm";

const NOW = new Date("2026-10-28T12:00:00.000Z");
const OLD = "2026-01-01T00:00:00.000Z";

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
  categoryCovers: {},
  artists: [],
  artistCount: null,
  story: null,
  sectionErrors: {},
};

const editions = (count: number): PublicArtworkSummary[] =>
  Array.from({ length: count }, (_, index) =>
    artworkSummary({ slug: `edition-${index + 1}`, title: `Edition ${index + 1}`, listedAt: OLD }),
  );

const artist = (slug: string, artworkCount = 2): PublicArtistSummary => ({
  slug,
  name: slug,
  discipline: null,
  portraitUrl: null,
  artworkCount,
});

function build(overrides: Partial<HomePageComposerResult> = {}, ctx = context) {
  return buildHomePageViewModel({ ...empty, ...overrides }, ctx);
}

describe("home hero", () => {
  it("leads with the newest featured edition that can still be bought", () => {
    const soldOut = artworkSummary({
      slug: "sold",
      availability: { totalEditions: 10, state: "sold_out" },
    });
    const live = artworkSummary({ slug: "live", title: "Harbour light", yearCreated: 2026 });
    expect(selectHomeRelease([soldOut, live], [])).toEqual({ item: live, featured: true });

    const hero = build({ featured: [soldOut, live] }).hero;
    expect(hero.eyebrow).toBe("New release · 1 Oct 2026");
    expect(hero.workLink).toEqual({ label: "See Harbour light", href: "/artworks/live" });
    expect(hero.release).toMatchObject({
      artistName: "Mara Ellison",
      titleLine: "Harbour light, 2026",
      priceLabel: "£340",
      factsLine: "Giclée print",
      editionLine: "Edition of 50",
    });
  });

  it("falls back to the newest edition on sale, and says so", () => {
    const hero = build({ editions: [artworkSummary({ listedAt: OLD })] }).hero;
    expect(hero.eyebrow).toBe("On sale now");
    expect(hero.release?.href).toBe("/artworks/harbour-light");
  });

  it("calls an older featured edition featured, not new", () => {
    expect(build({ featured: [artworkSummary({ listedAt: OLD })] }).hero.eyebrow).toBe(
      "Featured edition",
    );
  });

  it("still names what Shop sells when there is no release with an image", () => {
    const hero = build({ editions: [artworkSummary({ imageUrl: null })] }).hero;
    expect(hero.release).toBeNull();
    expect(hero.eyebrow).toBeNull();
    expect(hero.workLink).toBeNull();
    expect(hero.title).toBe("Limited editions by our gallery artists");
    expect(hero.primary).toEqual({ label: "Browse editions", href: "/artworks" });
  });

  it("gives the artist count and lowest price only when they are known and worth saying", () => {
    expect(heroLead(12, 9500)).toBe(
      "Limited-edition prints by 12 gallery artists, from £95. Prices include VAT.",
    );
    expect(heroLead(1, 9500)).toBe("Limited-edition prints from £95. Prices include VAT.");
    expect(heroLead(null, null)).toBe("Limited-edition prints. Prices include VAT.");
  });
});

describe("trust strip", () => {
  it("states delivery from the surcharge and the configured window, linked to its policy", () => {
    const trust = build().trust;
    expect(trust.map((item) => item.id)).toEqual(["editions", "gallery", "delivery", "returns"]);
    expect(trust[1]?.body).toBe(
      "Sold by London Art Exchange, 156 New Cavendish St, London W1W 6YW.",
    );
    expect(trust[2]).toMatchObject({
      title: "Insured UK delivery, £15",
      body: "3 to 5 working days, or free collection from the gallery.",
      link: { label: "Delivery", href: "/delivery" },
    });
  });

  it("drops a link whose policy page is not published here", () => {
    const trust = build({}, { ...context, linkablePolicies: [] }).trust;
    expect(trust.every((item) => item.link === null)).toBe(true);
  });
});

describe("new editions", () => {
  it("shows a row of four, leaving out the release already in the first screen", () => {
    const items = editions(6);
    const vm = build({ editions: items, availableCount: 12 });
    expect(vm.newEditions?.items.map((item) => item.slug)).toEqual([
      "edition-2",
      "edition-3",
      "edition-4",
      "edition-5",
    ]);
    expect(vm.newEditions?.viewAll.label).toBe("View all 12");
  });

  it("repeats the release rather than leave the row short", () => {
    const vm = build({ editions: editions(3) });
    expect(vm.newEditions?.items).toHaveLength(3);
    expect(vm.newEditions?.viewAll.label).toBe("View all");
  });

  it("is left out with fewer than three editions, so no row looks empty", () => {
    expect(build({ editions: editions(2) }).newEditions).toBeNull();
  });
});

describe("sections that hide when the catalogue is thin", () => {
  it("hides the story, artists and collections, and keeps the gallery team", () => {
    const vm = build({ editions: editions(1), artists: [artist("a"), artist("b")] });
    expect(vm.story).toBeNull();
    expect(vm.artists).toBeNull();
    expect(vm.collections).toEqual([]);
    expect(vm.quickFilters).toEqual([]);
    expect(vm.galleryTeam.phone).toEqual({ label: "+44 800 208 4800", href: "tel:+448002084800" });
  });

  it("shows artists with editions only, four at most, and points to their stories on lax.art", () => {
    const vm = build({
      artists: [artist("a"), artist("none", 0), artist("b"), artist("c"), artist("d"), artist("e")],
    });
    expect(vm.artists?.cards.map((card) => card.name)).toEqual(["a", "b", "c", "d"]);
    expect(vm.artists?.laxArtHref).toBe("https://art.test/artists");
  });

  it("shows a story when there is one to tell", () => {
    const story = {
      title: "Proofing Harbour light",
      body: "Three weeks at the press.",
      imageUrl: "/proof.webp",
      edition: { title: "Harbour light", href: "/artworks/harbour-light" },
      readMoreHref: null,
    };
    expect(build({ story }).story).toEqual(story);
  });
});

describe("product doors", () => {
  it("opens lax.art first, then LAX Bid, and leaves out a product without a link", () => {
    const links = [
      {
        id: "bid" as const,
        label: "LAX Bid",
        href: "https://bid.test",
        current: false,
        external: true,
      },
      {
        id: "art" as const,
        label: "lax.art",
        href: "https://art.test",
        current: false,
        external: true,
      },
    ];
    expect(buildShopProductDoors(links).map((door) => [door.product, door.href])).toEqual([
      ["art", "https://art.test"],
      ["bid", "https://bid.test"],
    ]);
    expect(buildShopProductDoors(links.slice(0, 1)).map((door) => door.product)).toEqual(["bid"]);
  });
});
