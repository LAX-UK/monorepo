import type { PortalSavedArtwork, PublicArtworkSummary } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { buildCatalogueArtistCards, buildFollowedArtistCards } from "./catalogue-artist-card.vm.js";
import {
  buildCatalogueArtworkCards,
  buildSavedArtworkCards,
  toCatalogueArtworkCardVm,
} from "./catalogue-artwork-card.vm.js";

const summary = (overrides: Partial<PublicArtworkSummary> = {}): PublicArtworkSummary => ({
  slug: "work",
  title: "Work",
  artistName: "Artist",
  artistSlug: "artist",
  imageUrl: "/work.webp",
  saleState: "price_on_application",
  dimensions: "40 × 50 cm",
  yearCreated: 2026,
  medium: "Oil on linen",
  salesChannel: "art",
  eligibleForEditionAllocation: false,
  printPricePence: null,
  availability: { totalEditions: 0, editionsAvailable: 0 },
  ...overrides,
});

const saved = (overrides: Partial<PortalSavedArtwork> = {}): PortalSavedArtwork => ({
  artworkSlug: "saved-work",
  artworkTitle: "Saved Work",
  artistName: "Flora Powers",
  artistSlug: "flora-powers",
  imageUrl: null,
  salesChannel: "art",
  savedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("catalogue artwork card view model", () => {
  it("maps the Figma card fields for a price on request original", () => {
    expect(toCatalogueArtworkCardVm(summary())).toEqual({
      slug: "work",
      title: "Work",
      artistName: "Artist",
      artistHref: "/artists/artist",
      imageUrl: "/work.webp",
      imageAlt: "Work by Artist",
      metaLine: "2026 · Oil on linen · 40 × 50 cm",
      priceLabel: "Price on request",
      href: "/artworks/work",
      enquireHref: "/artworks/work?enquire=1",
      saved: false,
    });
  });

  it("hides the enquiry action and labels sold works", () => {
    const card = toCatalogueArtworkCardVm(summary({ saleState: "sold" }));
    expect(card.priceLabel).toBe("Sold");
    expect(card.enquireHref).toBeNull();
  });

  it("marks saved works from one slug set", () => {
    const cards = buildCatalogueArtworkCards(
      [summary({ slug: "a" }), summary({ slug: "b" })],
      new Set(["b"]),
    );
    expect(cards.map((card) => card.saved)).toEqual([false, true]);
  });

  it("maps saved favorites and drops other storefront channels", () => {
    const cards = buildSavedArtworkCards([
      saved(),
      saved({ artworkSlug: "print", salesChannel: "shop" }),
    ]);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      href: "/artworks/saved-work",
      imageAlt: "Saved Work by Flora Powers",
      priceLabel: null,
      metaLine: null,
      saved: true,
    });
  });
});

describe("catalogue artist card view model", () => {
  it("prefers discipline and falls back to works count", () => {
    const [withDiscipline, withoutDiscipline] = buildCatalogueArtistCards([
      { slug: "a", name: "A", discipline: "Painter", portraitUrl: null, artworkCount: 2 },
      { slug: "b", name: "B", discipline: null, portraitUrl: null, artworkCount: 1 },
    ]);
    expect(withDiscipline).toMatchObject({
      href: "/artists/a",
      caption: "Painter",
      following: false,
    });
    expect(withoutDiscipline?.caption).toBe("1 work");
  });

  it("prefers nationality and years when the record carries them", () => {
    const base = { name: "A", discipline: "Painter", portraitUrl: null, artworkCount: 2 };
    const cards = buildCatalogueArtistCards([
      { ...base, slug: "a", nationality: "British", birthYear: 1924, deathYear: 2001 },
      { ...base, slug: "b", nationality: " ", birthYear: 1960, deathYear: null },
      { ...base, slug: "c", nationality: "French", birthYear: null, deathYear: null },
      { ...base, slug: "d", nationality: null, birthYear: null, deathYear: 1990 },
    ]);
    expect(cards.map((card) => card.caption)).toEqual([
      "British, 1924–2001",
      "b. 1960",
      "French",
      "Painter",
    ]);
  });

  it("marks followed artists from one slug set", () => {
    const cards = buildCatalogueArtistCards(
      [
        { slug: "a", name: "A", discipline: null, portraitUrl: null, artworkCount: 0 },
        { slug: "b", name: "B", discipline: null, portraitUrl: null, artworkCount: 0 },
      ],
      new Set(["b"]),
    );
    expect(cards.map((card) => card.following)).toEqual([false, true]);
  });

  it("maps followed artists", () => {
    expect(
      buildFollowedArtistCards([
        { artistSlug: "a", artistName: "A", portraitUrl: null, followedAt: "2026-01-01" },
      ])[0],
    ).toMatchObject({
      href: "/artists/a",
      imageAlt: "Portrait of A",
      caption: null,
      following: true,
    });
  });
});
