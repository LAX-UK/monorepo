import { describe, expect, it } from "vitest";
import {
  CATALOGUE_FRAMING_KEYS,
  CATALOGUE_FRAMING_RULES,
  catalogueFramingFor,
  catalogueOrientationFor,
  isCatalogueFramingKey,
  isCatalogueOrientationKey,
  isInCatalogueFraming,
} from "./catalogue-shape-framing.js";
import { FRAMING_MODES } from "./framing-edition.js";

describe("catalogue orientation", () => {
  it("calls a work portrait or landscape only when one side is more than 5 % longer", () => {
    expect(catalogueOrientationFor({ heightCm: 70, widthCm: 50 })).toBe("portrait");
    expect(catalogueOrientationFor({ heightCm: 50, widthCm: 70 })).toBe("landscape");
    expect(catalogueOrientationFor({ heightCm: 50, widthCm: 50 })).toBe("square");
    expect(catalogueOrientationFor({ heightCm: 52, widthCm: 50 })).toBe("square");
    expect(catalogueOrientationFor({ heightCm: 50, widthCm: 53 })).toBe("landscape");
  });

  it("keeps exactly 5 % longer square, and anything past it not", () => {
    expect(catalogueOrientationFor({ heightCm: 105, widthCm: 100 })).toBe("square");
    expect(catalogueOrientationFor({ heightCm: 105.01, widthCm: 100 })).toBe("portrait");
    expect(catalogueOrientationFor({ heightCm: 100, widthCm: 105 })).toBe("square");
    expect(catalogueOrientationFor({ heightCm: 100, widthCm: 105.01 })).toBe("landscape");
    // Fractional sizes that floating point would get wrong at the bound.
    expect(catalogueOrientationFor({ heightCm: 31.5, widthCm: 30 })).toBe("square");
    expect(catalogueOrientationFor({ heightCm: 29.7, widthCm: 42 })).toBe("landscape");
  });

  it("leaves out works without both sides", () => {
    expect(catalogueOrientationFor({ heightCm: null, widthCm: 50 })).toBeNull();
    expect(catalogueOrientationFor({ heightCm: 50, widthCm: null })).toBeNull();
    expect(catalogueOrientationFor({ heightCm: 0, widthCm: 50 })).toBeNull();
    expect(catalogueOrientationFor({ heightCm: 50, widthCm: -1 })).toBeNull();
  });

  it("recognises its keys", () => {
    expect(isCatalogueOrientationKey("portrait")).toBe(true);
    expect(isCatalogueOrientationKey("panoramic")).toBe(false);
  });
});

describe("catalogue framing", () => {
  it("lists an edition with no framing row as unframed only", () => {
    expect(catalogueFramingFor({ mode: null, hasOfferedOption: false })).toEqual(["unframed"]);
    expect(catalogueFramingFor({ mode: null, hasOfferedOption: true })).toEqual(["unframed"]);
  });

  it("lists framing to choose under both while an option is offered", () => {
    expect(catalogueFramingFor({ mode: "unframed_or_framed", hasOfferedOption: true })).toEqual([
      "framed",
      "unframed",
    ]);
    expect(catalogueFramingFor({ mode: "unframed_or_framed", hasOfferedOption: false })).toEqual([
      "unframed",
    ]);
  });

  it("lists framed only as framed while an option is offered, else nowhere", () => {
    expect(catalogueFramingFor({ mode: "framed_only", hasOfferedOption: true })).toEqual([
      "framed",
    ]);
    expect(catalogueFramingFor({ mode: "framed_only", hasOfferedOption: false })).toEqual([]);
  });

  it("lists framed by the artist as framed, with or without options", () => {
    expect(catalogueFramingFor({ mode: "framed_by_artist", hasOfferedOption: false })).toEqual([
      "framed",
    ]);
    expect(
      isInCatalogueFraming("unframed", { mode: "framed_by_artist", hasOfferedOption: true }),
    ).toBe(false);
  });

  it("has a rule for every key and only names known modes", () => {
    for (const key of CATALOGUE_FRAMING_KEYS) {
      const rule = CATALOGUE_FRAMING_RULES[key];
      for (const mode of [...rule.modes, ...rule.modesWithOfferedOption]) {
        expect(FRAMING_MODES).toContain(mode);
      }
    }
    expect(isCatalogueFramingKey("framed")).toBe(true);
    expect(isCatalogueFramingKey("framed_only")).toBe(false);
  });
});
