import { describe, expect, it } from "vitest";
import {
  exhibitionsAtVenue,
  telHref,
  venueCardAddressLines,
  venueMapsHref,
  venueSectionTabs,
} from "./venue.vm.js";

const noAddress = {
  latitude: null,
  longitude: null,
  address: null,
  streetLine: null,
  postcode: null,
  city: null,
  mapUrl: null,
};

describe("venueCardAddressLines", () => {
  it("puts the street first, then city and postcode", () => {
    expect(
      venueCardAddressLines({ streetLine: "12 Example Mews", postcode: "W1U 1AA", city: "London" }),
    ).toEqual(["12 Example Mews", "London W1U 1AA"]);
  });

  it("drops blank parts and tolerates missing fields", () => {
    expect(venueCardAddressLines({ streetLine: " ", postcode: "W1U 1AA", city: null })).toEqual([
      "W1U 1AA",
    ]);
    expect(venueCardAddressLines({})).toEqual([]);
  });
});

describe("venueMapsHref", () => {
  it("prefers coordinates", () => {
    expect(
      venueMapsHref({ ...noAddress, latitude: 51.5, longitude: -0.15, address: "1 Bond Street" }),
    ).toBe("https://www.google.com/maps/search/?api=1&query=51.5,-0.15");
  });

  it("falls back to an encoded address, preferring the street line", () => {
    expect(
      venueMapsHref({
        ...noAddress,
        address: "old",
        streetLine: "12 Example Mews",
        city: "London",
        postcode: "W1U 1AA",
      }),
    ).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("12 Example Mews, London, W1U 1AA")}`,
    );
  });

  it("uses an https map link only when nothing else is known", () => {
    expect(venueMapsHref({ ...noAddress, mapUrl: "https://maps.example/x" })).toBe(
      "https://maps.example/x",
    );
    expect(venueMapsHref({ ...noAddress, mapUrl: "javascript:alert(1)" })).toBeNull();
    expect(venueMapsHref(noAddress)).toBeNull();
  });
});

describe("exhibitionsAtVenue", () => {
  const show = (slug: string, venueSlug: string | null) => ({
    slug,
    kind: "exhibition" as const,
    title: slug,
    summary: null,
    startsOn: null,
    endsOn: null,
    coverUrl: null,
    featured: false,
    venue: venueSlug ? { slug: venueSlug, name: venueSlug } : null,
  });

  it("keeps only shows whose venue slug matches", () => {
    const cards = exhibitionsAtVenue(
      [show("a", "mayfair"), show("b", "soho"), show("c", null)],
      "mayfair",
    );
    expect(cards.map((card) => card.key)).toEqual(["a"]);
  });
});

describe("telHref", () => {
  it("strips spacing and punctuation but keeps the plus", () => {
    expect(telHref("+44 20 7946 0000")).toBe("tel:+442079460000");
    expect(telHref("(020) 7946-0000")).toBe("tel:02079460000");
  });
});

describe("venueSectionTabs", () => {
  it("lists the sections that render and none when fewer than two", () => {
    expect(venueSectionTabs({ location: true, exhibitions: true }).map((t) => t.id)).toEqual([
      "location",
      "exhibitions",
    ]);
    expect(venueSectionTabs({ location: true, exhibitions: false })).toEqual([]);
    expect(venueSectionTabs({ location: false, exhibitions: false })).toEqual([]);
  });
});
