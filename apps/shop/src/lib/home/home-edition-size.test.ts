import { describe, expect, it } from "vitest";
import { editionSizeCm, editionSizeLabel } from "./home-edition-size";

describe("editionSizeCm", () => {
  it("reads the catalogue's height and width", () => {
    expect(editionSizeCm({ dimensionsCmDisplay: "70 cm H × 100 cm W" })).toEqual({
      heightCm: 70,
      widthCm: 100,
    });
    expect(editionSizeCm({ dimensionsCmDisplay: "29,7 cm H × 21 cm W × 2 cm D" })).toEqual({
      heightCm: 29.7,
      widthCm: 21,
    });
  });

  it("does not guess when a side or the whole size is missing", () => {
    expect(editionSizeCm({ dimensionsCmDisplay: "70 cm H" })).toBeNull();
    expect(editionSizeCm({ dimensionsCmDisplay: "28 x 21 in." })).toBeNull();
    expect(editionSizeCm({})).toBeNull();
  });
});

describe("editionSizeLabel", () => {
  it("says height, then width", () => {
    expect(editionSizeLabel({ heightCm: 120, widthCm: 90 })).toBe("120 × 90 cm");
    expect(editionSizeLabel({ heightCm: 29.7, widthCm: 21 })).toBe("29.7 × 21 cm");
    expect(editionSizeLabel(null)).toBeNull();
  });
});
