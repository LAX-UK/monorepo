import { artworkSummary } from "@/test/artwork-summary.fixture";
import { describe, expect, it } from "vitest";
import { toEditionCardVm } from "./edition-card.vm";
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
