import { describe, expect, it } from "vitest";
import { longSideCmFromDimensions } from "./dimensions";

describe("longSideCmFromDimensions", () => {
  it.each([
    ["180 x 140 cm", 180],
    ["140 × 180 cm", 180],
    ["70 by 90cm", 90],
    ["100cm x 80cm", 100],
    ["80cm x 100cm", 100],
    ["27.5 x 35 cm", 35],
    ["27,5 x 35 cm", 35],
    ["60 x 40 x 5 cm", 60],
    ["40 cm", 40],
    ["500 x 700 mm", 70],
    ["20 x 30 in", 76.2],
    ['20 x 30"', 76.2],
  ])("reads %s as %s cm", (text, expected) => {
    expect(longSideCmFromDimensions(text)).toBe(expected);
  });

  it("prefers the centimetres when several units are given", () => {
    expect(longSideCmFromDimensions("28 x 21 in. (71 x 53 cm)")).toBe(71);
    expect(longSideCmFromDimensions("71 x 53 cm (28 x 21 in.)")).toBe(71);
  });

  it("does not treat a depth as the long side", () => {
    expect(longSideCmFromDimensions("30 x 20 x 90 cm")).toBe(30);
  });

  it.each([null, undefined, "", "Large", "Size to follow", "180 x 140", "Unframed"])(
    "returns null for %s",
    (text) => {
      expect(longSideCmFromDimensions(text)).toBeNull();
    },
  );
});
