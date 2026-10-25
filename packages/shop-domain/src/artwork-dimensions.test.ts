import { describe, expect, it } from "vitest";
import { formatArtworkDimensionsCm, formatArtworkSize } from "./artwork-dimensions.js";

describe("formatArtworkDimensionsCm", () => {
  it("formats height and width", () => {
    expect(formatArtworkDimensionsCm({ heightCm: 80, widthCm: 60, depthCm: null })).toBe(
      "80 cm H × 60 cm W",
    );
  });

  it("returns null when all dimensions are missing", () => {
    expect(formatArtworkDimensionsCm({ heightCm: null, widthCm: null, depthCm: null })).toBeNull();
  });
});

describe("formatArtworkSize", () => {
  it("gives centimetres and inches to one decimal place", () => {
    expect(formatArtworkSize({ heightCm: 50, widthCm: 40, depthCm: null })).toEqual({
      cm: "50 × 40 cm",
      inches: "19.7 × 15.7 in",
    });
    expect(formatArtworkSize({ heightCm: 50, widthCm: 40, depthCm: 3.5 })).toEqual({
      cm: "50 × 40 × 3.5 cm",
      inches: "19.7 × 15.7 × 1.4 in",
    });
  });

  it("is null without a positive height and width", () => {
    expect(formatArtworkSize({ heightCm: 50, widthCm: null, depthCm: null })).toBeNull();
    expect(formatArtworkSize({ heightCm: 0, widthCm: 40, depthCm: null })).toBeNull();
  });
});
