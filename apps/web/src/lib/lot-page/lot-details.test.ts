import { describe, expect, it } from "vitest";
import { buildLotDetails, lotFactsLine } from "./lot-details";

describe("buildLotDetails", () => {
  it("builds the about text and only the facts the lot has", () => {
    const view = buildLotDetails({
      description: "Painted from the sea wall.\n\nPart of a series.",
      marketingDetails: {
        provenance: [
          { period: "2019", note: "The artist's studio" },
          { note: "Private collection" },
        ],
        conditionReport: { summary: "Good overall.", downloadUrl: "https://example.test/cr.pdf" },
      },
    });
    expect(view.about).toEqual(["Painted from the sea wall.", "Part of a series."]);
    expect(view.facts).toEqual([
      { label: "Provenance", text: "2019: The artist's studio; Private collection" },
      {
        label: "Condition",
        text: "Good overall.",
        links: [{ label: "Read the condition report", href: "https://example.test/cr.pdf" }],
      },
    ]);
  });

  it("lists documents with their links", () => {
    const view = buildLotDetails({
      description: null,
      marketingDetails: {},
      documents: [{ label: "Certificate", href: "https://example.test/c.pdf" }],
    });
    expect(view.facts).toEqual([
      {
        label: "Documents",
        text: "Available to read before you bid.",
        links: [{ label: "Certificate", href: "https://example.test/c.pdf" }],
      },
    ]);
  });

  it("is empty when the lot has nothing to say", () => {
    expect(buildLotDetails({ description: null, marketingDetails: {} })).toEqual({
      about: [],
      facts: [],
    });
  });
});

describe("lotFactsLine", () => {
  it("joins medium and size with a proper multiplication sign", () => {
    expect(lotFactsLine({ medium: "Oil on canvas", dimensions: "90 x 120 cm" })).toBe(
      "Oil on canvas · 90 × 120 cm",
    );
  });

  it("skips what is missing", () => {
    expect(lotFactsLine({ medium: null, dimensions: "90 x 120 cm" })).toBe("90 × 120 cm");
    expect(lotFactsLine({ medium: " ", dimensions: null })).toBeNull();
  });
});
