import { artworkSummary } from "@/test/artwork-summary.fixture";
import { describe, expect, it } from "vitest";
import { buildEditionCards, toEditionCardVm } from "./edition-card.vm";
import { formatReleaseDate, isNewRelease } from "./edition-release";

const NOW = new Date("2026-10-28T12:00:00.000Z");

describe("new releases", () => {
  it("counts a work as new for 30 days after it is listed", () => {
    expect(isNewRelease("2026-10-27T12:00:00.000Z", NOW)).toBe(true);
    expect(isNewRelease("2026-09-29T12:00:01.000Z", NOW)).toBe(true);
    expect(isNewRelease("2026-09-28T12:00:00.000Z", NOW)).toBe(false);
  });

  it("is never new without a usable date, or with one in the future", () => {
    expect(isNewRelease(undefined, NOW)).toBe(false);
    expect(isNewRelease("not a date", NOW)).toBe(false);
    expect(isNewRelease("2026-11-01T00:00:00.000Z", NOW)).toBe(false);
  });

  it("dates a release in London time", () => {
    expect(formatReleaseDate("2026-07-14T23:30:00.000Z")).toBe("15 Jul 2026");
    expect(formatReleaseDate(null)).toBeNull();
  });
});

describe("edition card", () => {
  it("reads artist, title, technique and edition size, and the price in whole pounds", () => {
    expect(toEditionCardVm(artworkSummary(), NOW)).toMatchObject({
      href: "/artworks/harbour-light",
      artistName: "Mara Ellison",
      artistHref: "/artists/mara-ellison",
      title: "Harbour light",
      imageAlt: "Harbour light by Mara Ellison",
      factsLine: "Giclée print · Edition of 50",
      priceLabel: "£340",
      status: { kind: "new", label: "New" },
    });
  });

  it("shows no status once the release window has passed", () => {
    const card = toEditionCardVm(artworkSummary({ listedAt: "2026-01-01T00:00:00.000Z" }), NOW);
    expect(card.status).toBeNull();
  });

  it("puts sold out in place of the price, with alerts, and never also calls it new", () => {
    const card = toEditionCardVm(
      artworkSummary({ availability: { totalEditions: 50, state: "sold_out" } }),
      NOW,
    );
    expect(card.priceLabel).toBeNull();
    expect(card.status).toEqual({
      kind: "sold_out",
      label: "Sold out",
      alertLabel: "Get alerts",
      alertHref: "/artworks/harbour-light#edition-alert",
    });
  });

  it("leaves out facts the catalogue does not hold", () => {
    expect(
      toEditionCardVm(
        artworkSummary({ medium: null, availability: { totalEditions: 0, state: "available" } }),
        NOW,
      ).factsLine,
    ).toBeNull();
    expect(toEditionCardVm(artworkSummary({ medium: null }), NOW).factsLine).toBe("Edition of 50");
  });

  it("has no price line for an edition not yet priced", () => {
    expect(toEditionCardVm(artworkSummary({ printPricePence: null }), NOW).priceLabel).toBeNull();
  });
});

describe("edition card facts line", () => {
  it("joins technique, run and signature once, with no repeated edition size", () => {
    const card = toEditionCardVm(
      artworkSummary({
        medium: "Giclée",
        availability: { totalEditions: 30, state: "available" },
        editionCardLine: "Limited edition of 30 · Hand-signed",
      }),
      NOW,
    );
    expect(card.factsLine).toBe("Giclée · Edition of 30 · Hand-signed");
  });

  it("keeps other run wording as shop-domain wrote it", () => {
    expect(
      toEditionCardVm(artworkSummary({ editionCardLine: "Open edition · Plate-signed" }), NOW)
        .factsLine,
    ).toBe("Giclée print · Open edition · Plate-signed");
  });

  it("falls back to the edition size without confirmed facts or from an older shop-api", () => {
    expect(toEditionCardVm(artworkSummary({ editionCardLine: null }), NOW).factsLine).toBe(
      "Giclée print · Edition of 50",
    );
    expect(toEditionCardVm(artworkSummary({ editionCardLine: "  " }), NOW).factsLine).toBe(
      "Giclée print · Edition of 50",
    );
  });
});

describe("one card per work", () => {
  const main = artworkSummary({
    slug: "harbour-at-dusk",
    title: "Harbour at dusk, unsigned",
    workSlug: "harbour-at-dusk",
    printPricePence: 15000,
    editionCardLine: "Open edition · Plate-signed",
    listedAt: "2026-01-01T00:00:00.000Z",
  });
  const proof = artworkSummary({
    slug: "harbour-at-dusk-artists-proof",
    title: "Harbour at dusk (artist's proof)",
    workSlug: "harbour-at-dusk",
    printPricePence: 9500,
    editionCardLine: "Limited edition of 30 · Hand-signed",
    listedAt: "2026-01-01T00:00:00.000Z",
  });

  it("shows the cheapest version's facts and 'From £95 · 2 versions'", () => {
    const cards = buildEditionCards([main, proof], NOW);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      title: "Harbour at dusk (artist's proof)",
      factsLine: "Giclée print · Edition of 30 · Hand-signed",
      priceLabel: "From £95 · 2 versions",
      versionCount: 2,
      href: "/artworks/harbour-at-dusk",
    });
  });

  it("is sold out only when every version is", () => {
    const soldOut = { availability: { totalEditions: 30, state: "sold_out" as const } };
    expect(buildEditionCards([main, { ...proof, ...soldOut }], NOW)[0]?.status).toBeNull();
    const all = buildEditionCards(
      [
        { ...main, ...soldOut },
        { ...proof, ...soldOut },
      ],
      NOW,
    )[0];
    expect(all?.status?.kind).toBe("sold_out");
    expect(all?.priceLabel).toBeNull();
  });

  it("prices from the versions that can be bought", () => {
    const soldProof = { ...proof, availability: { totalEditions: 30, state: "sold_out" as const } };
    const card = buildEditionCards([main, soldProof], NOW)[0];
    expect(card?.priceLabel).toBe("From £150 · 2 versions");
    expect(card?.title).toBe("Harbour at dusk, unsigned");
  });

  it("marks the work new when any version is new", () => {
    const fresh = { ...proof, listedAt: "2026-10-20T00:00:00.000Z" };
    expect(buildEditionCards([main, fresh], NOW)[0]?.status).toEqual({ kind: "new", label: "New" });
  });

  it("shows a lone edition's price without a version count", () => {
    const card = buildEditionCards([main], NOW)[0];
    expect(card?.priceLabel).toBe("£150");
    expect(card?.versionCount).toBe(1);
  });
});
