import {
  buildGoogleMapsEmbedUrl,
  buildGoogleMapsSearchUrl,
  formatPostalAddress,
  formatPostalAddressLines,
  hasStructuredAddress,
  isOnsiteLocationPopulated,
  isOnsiteLocationReadyForPublish,
  isUkPostcode,
  normalizeUkPostcode,
  resolveOnsiteMapUrl,
} from "@auction/validators";
import { describe, expect, it } from "vitest";

describe("normalizeUkPostcode", () => {
  it("uppercases and inserts a single space", () => {
    expect(normalizeUkPostcode("sw1y6qu")).toBe("SW1Y 6QU");
    expect(normalizeUkPostcode("  sw1y 6qu  ")).toBe("SW1Y 6QU");
    expect(normalizeUkPostcode("EC1A1BB")).toBe("EC1A 1BB");
  });

  it("returns trimmed input for non-UK postcodes", () => {
    expect(normalizeUkPostcode(" 90210 ")).toBe("90210");
  });
});

describe("isUkPostcode", () => {
  it("accepts common UK postcode formats", () => {
    expect(isUkPostcode("SW1Y 6QU")).toBe(true);
    expect(isUkPostcode("ec1a1bb")).toBe(true);
    expect(isUkPostcode("M1 1AE")).toBe(true);
  });

  it("rejects obvious non-postcodes", () => {
    expect(isUkPostcode("90210")).toBe(false);
    expect(isUkPostcode("hello world")).toBe(false);
  });
});

describe("hasStructuredAddress", () => {
  it("is true when at least one structured field is non-empty", () => {
    expect(hasStructuredAddress({ locationCity: "London" })).toBe(true);
    expect(hasStructuredAddress({ locationPostcode: "SW1Y 6QU" })).toBe(true);
  });

  it("ignores legacy locationAddress", () => {
    expect(hasStructuredAddress({ locationAddress: "1 Old Street" })).toBe(false);
  });

  it("treats whitespace as empty", () => {
    expect(hasStructuredAddress({ locationCity: "   " })).toBe(false);
  });
});

describe("formatPostalAddress", () => {
  it("falls back to locationAddress when no structured data is present", () => {
    expect(formatPostalAddress({ locationAddress: "1 Old Street, London" })).toBe(
      "1 Old Street, London",
    );
  });

  it("assembles a single-line address from structured fields", () => {
    const formatted = formatPostalAddress({
      locationAddressLine1: "34 New Bond Street",
      locationCity: "London",
      locationCounty: "Greater London",
      locationPostcode: "W1A 2AA",
      locationCountry: "United Kingdom",
    });
    expect(formatted).toBe("34 New Bond Street, London, Greater London W1A 2AA, United Kingdom");
  });
});

describe("formatPostalAddressLines", () => {
  it("returns the structured fields as separate lines", () => {
    const lines = formatPostalAddressLines({
      locationAddressLine1: "34 New Bond Street",
      locationCity: "London",
      locationPostcode: "W1A 2AA",
      locationCountry: "United Kingdom",
    });
    expect(lines).toEqual(["34 New Bond Street", "London", "W1A 2AA", "United Kingdom"]);
  });

  it("splits a free-form fallback on newlines", () => {
    const lines = formatPostalAddressLines({
      locationAddress: "34 New Bond Street\nLondon\nW1A 2AA",
    });
    expect(lines).toEqual(["34 New Bond Street", "London", "W1A 2AA"]);
  });
});

describe("buildGoogleMapsSearchUrl", () => {
  it("returns null when no fields are present", () => {
    expect(buildGoogleMapsSearchUrl({})).toBeNull();
  });

  it("builds a no-key search URL from venue + structured address", () => {
    const url = buildGoogleMapsSearchUrl({
      locationName: "Sotheby's London",
      locationAddressLine1: "34 New Bond Street",
      locationCity: "London",
      locationPostcode: "W1A 2AA",
      locationCountry: "United Kingdom",
    });
    expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
    expect(url).toContain(encodeURIComponent("Sotheby's London"));
    expect(url).toContain(encodeURIComponent("W1A 2AA"));
  });
});

describe("buildGoogleMapsEmbedUrl", () => {
  it("returns null when there is nothing to query", () => {
    expect(buildGoogleMapsEmbedUrl({})).toBeNull();
  });

  it("includes output=embed for a no-key iframe preview", () => {
    const url = buildGoogleMapsEmbedUrl({ locationCity: "London", locationPostcode: "W1A 2AA" });
    expect(url).toContain("output=embed");
    expect(url).toContain(encodeURIComponent("W1A 2AA"));
  });
});

describe("resolveOnsiteMapUrl", () => {
  it("prefers an explicit locationMapUrl over generated URL", () => {
    const url = resolveOnsiteMapUrl({
      locationMapUrl: "https://maps.example.com/custom",
      locationCity: "London",
    });
    expect(url).toBe("https://maps.example.com/custom");
  });

  it("falls back to a generated URL when no override is set", () => {
    const url = resolveOnsiteMapUrl({
      locationCity: "London",
      locationPostcode: "W1A 2AA",
    });
    expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
  });

  it("returns null when nothing is available", () => {
    expect(resolveOnsiteMapUrl({})).toBeNull();
  });
});

describe("isOnsiteLocationPopulated", () => {
  it("requires a venue name plus structured or legacy address", () => {
    expect(
      isOnsiteLocationPopulated({
        locationName: "Main Hall",
        locationAddressLine1: "1 Bond Street",
        locationCity: "London",
      }),
    ).toBe(true);
    expect(
      isOnsiteLocationPopulated({
        locationName: "Main Hall",
        locationAddress: "1 Bond Street, London",
      }),
    ).toBe(true);
  });

  it("rejects address-only or name-only input", () => {
    expect(isOnsiteLocationPopulated({ locationAddressLine1: "1 Bond Street" })).toBe(false);
    expect(isOnsiteLocationPopulated({ locationName: "Main Hall" })).toBe(false);
  });
});

describe("isOnsiteLocationReadyForPublish", () => {
  it("accepts a saved venue without manual location fields", () => {
    expect(isOnsiteLocationReadyForPublish({ venueId: "venue-1" })).toBe(true);
  });

  it("accepts manual location when populated", () => {
    expect(
      isOnsiteLocationReadyForPublish({
        locationName: "Main Hall",
        locationCity: "London",
      }),
    ).toBe(true);
  });

  it("rejects empty onsite location", () => {
    expect(isOnsiteLocationReadyForPublish({})).toBe(false);
  });
});
