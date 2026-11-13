import { describe, expect, it } from "vitest";
import { type RgbPixels, extractPalette, sampleZone } from "./cover-pixels.js";

function image(
  width: number,
  height: number,
  colour: (x: number, y: number) => number[],
): RgbPixels {
  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data.set(colour(x, y), (y * width + x) * 3);
    }
  }
  return { data, width, height };
}

describe("sampling a text zone", () => {
  it("reads the lightest and darkest colour inside the zone only", () => {
    const pixels = image(100, 50, (x) => (x < 50 ? [20, 20, 20] : [240, 240, 240]));
    expect(sampleZone(pixels, { x: 0, y: 0, width: 40, height: 50 })).toEqual({
      brightest: "#141414",
      darkest: "#141414",
    });
    expect(sampleZone(pixels, { x: 60, y: 0, width: 40, height: 50 })).toEqual({
      brightest: "#f0f0f0",
      darkest: "#f0f0f0",
    });
  });

  it("ignores a stray highlight by reading the 98th percentile", () => {
    const pixels = image(100, 100, (x, y) => (x === 3 && y === 3 ? [255, 255, 255] : [30, 30, 30]));
    expect(sampleZone(pixels, { x: 0, y: 0, width: 100, height: 100 }).brightest).toBe("#1e1e1e");
  });

  it("reports a gradient's bright and dark ends", () => {
    const pixels = image(100, 10, (x) => [x * 2, x * 2, x * 2]);
    const sample = sampleZone(pixels, { x: 0, y: 0, width: 100, height: 10 });
    expect(Number.parseInt(sample.brightest.slice(1, 3), 16)).toBeGreaterThan(190);
    expect(Number.parseInt(sample.darkest.slice(1, 3), 16)).toBeLessThan(10);
  });

  it("clips a zone to the picture and refuses one entirely outside it", () => {
    const pixels = image(20, 20, () => [100, 100, 100]);
    expect(sampleZone(pixels, { x: 10, y: 10, width: 50, height: 50 }).brightest).toBe("#646464");
    expect(() => sampleZone(pixels, { x: 40, y: 40, width: 5, height: 5 })).toThrow();
  });
});

describe("finding the palette", () => {
  it("takes the fullest colour as dominant and the darkest significant one as deepest", () => {
    // 60% warm sand, 38% navy, 2% (just under the cut) black speckle.
    const pixels = image(100, 100, (x, y) => {
      if (y < 60) return [210, 180, 130];
      if (y < 98) return [20, 30, 90];
      return x < 100 ? [0, 0, 0] : [0, 0, 0];
    });
    const { dominant, deepest } = extractPalette(pixels);
    expect(dominant[0]).toBeGreaterThan(190);
    // Black fills exactly 2% of the picture, which counts; navy would be next.
    expect(deepest[0]).toBe(0);
  });

  it("does not let a few black pixels become the deepest colour", () => {
    const pixels = image(100, 100, (x, y) => {
      if (y === 0 && x < 10) return [0, 0, 0];
      return y < 50 ? [210, 180, 130] : [20, 30, 90];
    });
    const { deepest } = extractPalette(pixels);
    expect(deepest).toEqual([20, 30, 90]);
  });

  it("works on a flat picture", () => {
    const { dominant, deepest } = extractPalette(image(8, 8, () => [90, 90, 90]));
    expect(dominant).toEqual([90, 90, 90]);
    expect(deepest).toEqual([90, 90, 90]);
  });
});
