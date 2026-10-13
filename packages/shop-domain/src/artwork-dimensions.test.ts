import { describe, expect, it } from "vitest";
import { formatArtworkDimensionsCm } from "./artwork-dimensions.js";

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
