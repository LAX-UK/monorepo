import { artworkSummary } from "@/test/artwork-summary.fixture";
import type { PublicArtistSummary, PublicArtworkSummary } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import type { ShopImageFacts } from "./home-image-facts";
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

/** Every photograph can be read, unless a test says otherwise. */
const allPhotographsRead: ReadonlyMap<string, ShopImageFacts> = Object.assign(
  new Map<string, ShopImageFacts>(),
  { has: () => true, get: () => ({ width: 800, height: 1000, mean: [120, 90, 80] as const }) },
);

const context: HomePageContext = {
  now: NOW,
  artBaseUrl: new URL("https://art.test"),
  productLinks: [],
  linkablePolicies: ["help", "delivery", "returns"],
  deliveryTimes: { ukDelivery: { min: 3, max: 5 }, collection: { min: 2, max: 2 } },
  imageSrc: (item) => item.imageUrl,
  imageFacts: allPhotographsRead,
};

/** A print photograph read from the server: its size and colour. */
const facts = (width = 800, height = 1000) => ({ width, height, mean: [120, 90, 80] as const });

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
    artworkSummary({
      slug: `edition-${index + 1}`,
      title: `Edition ${index + 1}`,
      imageUrl: `/edition-${index + 1}.webp`,
      listedAt: OLD,
    }),
  );

const artist = (slug: string): PublicArtistSummary => ({
  slug,
  name: slug,
  discipline: null,
  portraitUrl: null,
  artworkCount: 2,
});

/** Only the first of `editions(n)` has a photograph that reads, so no wall can be hung. */
const firstPhotographRead: HomePageContext = {
  ...context,
  imageFacts: new Map([["/edition-1.webp", facts()]]),
};

function build(overrides: Partial<HomePageComposerResult> = {}, ctx = context) {
  return buildHomePageViewModel({ ...empty, ...overrides }, ctx);
}

describe("home hero", () => {
  it("leads with the release itself: its title, one line of fact and the way to it", () => {
    const soldOut = artworkSummary({
      slug: "sold",
      availability: { totalEditions: 10, state: "sold_out" },
    });
    const live = artworkSummary({ slug: "live", title: "Harbour light", yearCreated: 2026 });
    const hero = build({ featured: [soldOut, live], availableCount: 1 }).hero;
    expect(hero.title).toBe("Harbour light");
    expect(hero.eyebrow).toBe("New release · 1 Oct 2026");
    expect(hero.lead).toBe("A new limited edition by Mara Ellison · Giclée print");
    expect(hero.primary).toEqual({ label: "See the edition", href: "/artworks/live" });
    expect(hero.link).toEqual({ label: "Browse all editions", href: "/artworks" });
    expect(hero.release).toMatchObject({
      href: "/artworks/live",
      line: "Mara Ellison · Harbour light · edition of 50 · £340",
    });
  });

  it("gives no eyebrow to an older edition chosen by the rule", () => {
    const hero = build({ editions: [artworkSummary({ listedAt: OLD })], availableCount: 1 }).hero;
    expect(hero.eyebrow).toBeNull();
    expect(hero.lead).toMatch(/^A limited edition by/);
    expect(hero.release?.href).toBe("/artworks/harbour-light");
  });

  it("still names what Shop sells when no release has an image", () => {
    const hero = build({ editions: [artworkSummary({ imageUrl: null })], availableCount: 1 }).hero;
    expect(hero.release).toBeNull();
    expect(hero.title).toBe("Limited-edition prints from our Marylebone gallery");
    expect(hero.link).toEqual({ label: "See the artists", href: "/artists" });
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
    expect(vm.layout.sections).toEqual(["hero", "release-alerts", "product-doors", "gallery-team"]);
  });

  it("does not claim the Shop is empty when the editions read failed", () => {
    const vm = build({ sectionErrors: { editions: "down" } });
    expect(vm.hero.title).toBe("Limited-edition prints from our Marylebone gallery");
    expect(vm.layout.sections).toContain("new-editions");
  });
});

describe("the cover without a photograph that can be shown", () => {
  const unreadable = artworkSummary({
    slug: "vessel-study",
    title: "Vessel Study",
    imageUrl: "/vessel.webp",
  });
  const readable = artworkSummary({ slug: "harbour-light", imageUrl: "/harbour.webp" });
  const onlyHarbour = (): HomePageContext => ({
    ...context,
    imageFacts: new Map([["/harbour.webp", facts()]]),
  });

  it("passes over a featured edition whose photograph cannot be read, to the next lead", () => {
    const vm = build({ featured: [unreadable, readable], availableCount: 2 }, onlyHarbour());
    expect(vm.hero.title).toBe("Harbour light");
    expect(vm.hero.release?.imageUrl).toBe("/harbour.webp");
    expect(vm.coverPlate).not.toBeNull();
  });

  it("falls to the newest edition that has a photograph when no featured one can lead", () => {
    const vm = build(
      { featured: [unreadable], editions: [unreadable, readable], availableCount: 2 },
      onlyHarbour(),
    );
    expect(vm.hero.title).toBe("Harbour light");
    expect(vm.hero.eyebrow).not.toBe("Featured edition");
  });

  it("passes over an edition whose address cannot be resolved", () => {
    const vm = build(
      { featured: [readable], availableCount: 1 },
      { ...onlyHarbour(), imageSrc: () => null },
    );
    expect(vm.hero.release).toBeNull();
    expect(vm.coverPlate).toBeNull();
  });

  it("is the text cover, never an empty panel, when no edition has a photograph that reads", () => {
    const vm = build(
      { featured: [unreadable], editions: [unreadable], availableCount: 1 },
      { ...context, imageFacts: new Map() },
    );
    expect(vm.hero.release).toBeNull();
    expect(vm.coverPlate).toBeNull();
    expect(vm.hero.title).toBe("Limited-edition prints from our Marylebone gallery");
    expect(vm.hero.primary).toEqual({ label: "Browse editions", href: "/artworks" });
  });
});

describe("the cover's print", () => {
  const release = artworkSummary({ slug: "live", imageUrl: "/live.webp" });

  it("is read from the release photograph and set on a pale field taken from it", () => {
    const vm = build(
      { featured: [release], availableCount: 1 },
      { ...context, imageFacts: new Map([["/live.webp", facts()]]) },
    );
    expect(vm.coverPlate).toMatchObject({ width: 800, height: 1000 });
    expect(vm.coverPlate?.field).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("is left out when the photograph could not be read, so the cover is type", () => {
    expect(
      build({ featured: [release], availableCount: 1 }, { ...context, imageFacts: new Map() })
        .coverPlate,
    ).toBeNull();
  });

  it("is never missing for a release: the release is chosen among editions whose photograph reads", () => {
    const vm = build({ featured: [release], availableCount: 1 });
    expect(vm.hero.release).not.toBeNull();
    expect(vm.coverPlate).not.toBeNull();
  });
});

describe("the hang", () => {
  const photographed = (count: number) =>
    editions(count).map((item) => ({ ...item, imageUrl: `/${item.slug}.webp` }));
  const read = (items: PublicArtworkSummary[]) =>
    new Map(items.map((item) => [item.imageUrl ?? "", facts()] as const));

  it("takes the New editions place, with the release first, and the card row steps aside", () => {
    const items = photographed(4);
    const vm = build(
      { editions: items, availableCount: 4 },
      { ...context, imageFacts: read(items) },
    );
    expect(vm.hang?.works.map((work) => work.slug)).toEqual([
      "edition-1",
      "edition-2",
      "edition-3",
      "edition-4",
    ]);
    expect(vm.layout.sections.slice(0, 2)).toEqual(["hero", "hang"]);
    expect(vm.layout.sections).not.toContain("new-editions");
  });

  it("needs two readable photographs; with fewer the card row stays", () => {
    const items = photographed(3);
    const vm = build(
      { editions: items, availableCount: 3 },
      { ...context, imageFacts: read(items.slice(0, 1)) },
    );
    expect(vm.hang).toBeNull();
    expect(vm.layout.sections).toContain("new-editions");
  });
});

describe("new editions", () => {
  it("leaves out the release already in the first screen", () => {
    const vm = build({ editions: editions(6), availableCount: 12 }, firstPhotographRead);
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
      { ...firstPhotographRead, productLinks: [art] },
    );
    expect(vm.layout.sections).toEqual([
      "hero",
      "trust",
      "new-editions",
      "artists",
      "release-alerts",
      "product-doors",
      "gallery-team",
    ]);
    expect(vm.layout.surfaces.hero).toBe("plain");
    expect(vm.layout.surfaces["gallery-team"]).toBe("band");
    // The doors between them keep the two tinted bands apart.
    expect(vm.layout.surfaces["release-alerts"]).toBe("band");
    expect(vm.layout.surfaces["product-doors"]).toBe("plain");
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
