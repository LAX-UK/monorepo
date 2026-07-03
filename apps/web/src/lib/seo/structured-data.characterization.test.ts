import { describe, expect, it } from "vitest";
import * as jsonld from "./jsonld";
import * as legacyBarrel from "./structured-data";

const EXPECTED_EXPORT_KEYS = [
  "brandOrOrganizationJsonLd",
  "breadcrumbJsonLd",
  "creatorJsonLd",
  "faqPageJsonLd",
  "homeUpcomingItemListJsonLd",
  "itemListJsonLd",
  "jsonLdScript",
  "localBusinessJsonLd",
  "lotProductJsonLd",
  "organizationJsonLd",
  "personJsonLd",
  "policyHubPageJsonLd",
  "saleDayGalleryJsonLd",
  "saleEventJsonLd",
  "salePressJsonLd",
  "saleRecordingVideoJsonLd",
  "visualArtistJsonLd",
  "webPageJsonLd",
  "websiteJsonLd",
] as const;

describe("structured-data characterization", () => {
  it("legacy barrel and jsonld index expose the same export key set", () => {
    const legacyKeys = Object.keys(legacyBarrel).sort();
    const moduleKeys = Object.keys(jsonld).sort();
    expect(legacyKeys).toEqual(moduleKeys);
  });

  it("exports a stable public API key set", () => {
    expect([...Object.keys(legacyBarrel)].sort()).toEqual([...EXPECTED_EXPORT_KEYS].sort());
  });

  it("jsonLdScript still escapes angle brackets", () => {
    expect(jsonld.jsonLdScript({ html: "<script>" })).toContain("\\u003c");
  });
});
