import { describe, expect, it } from "vitest";
import { regionPixelsFromRgba } from "./extract-region-pixels";
import {
  defaultTaintedResult,
  pickOverlayToneFromRegion,
  relativeLuminance,
} from "./pick-overlay-tone";

function solidPixels(
  r: number,
  g: number,
  b: number,
  size = 32,
): ReturnType<typeof regionPixelsFromRgba> {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return regionPixelsFromRgba(data, size, size);
}

describe("pickOverlayToneFromRegion", () => {
  it("picks light frosted tone on dark background", () => {
    const pixels = solidPixels(10, 10, 10);
    const result = pickOverlayToneFromRegion(pixels, "pill");
    expect(result.kind).toBe("frosted");
    expect(result.tone).toBe("light");
  });

  it("picks dark frosted tone on bright background", () => {
    const pixels = solidPixels(240, 240, 240);
    const result = pickOverlayToneFromRegion(pixels, "pill");
    expect(result.kind).toBe("frosted");
    expect(result.tone).toBe("dark");
  });

  it("does not force opaque on single hot pixel in dark region", () => {
    const data = new Uint8ClampedArray(32 * 32 * 4);
    for (let i = 0; i < 32 * 32; i++) {
      data[i * 4] = 20;
      data[i * 4 + 1] = 20;
      data[i * 4 + 2] = 20;
      data[i * 4 + 3] = 255;
    }
    data[0] = 255;
    data[1] = 255;
    data[2] = 255;
    const pixels = regionPixelsFromRgba(data, 32, 32);
    const result = pickOverlayToneFromRegion(pixels, "pill");
    expect(result.kind).toBe("frosted");
    expect(result.tone).toBe("light");
  });

  it("returns opaque result for tainted canvas default", () => {
    const result = defaultTaintedResult();
    expect(result.kind).toBe("opaque");
    expect(result.tone).toBe("light");
  });

  it("always returns a valid tone and contrast", () => {
    for (const rgb of [
      [10, 10, 10],
      [240, 240, 240],
      [128, 128, 128],
    ] as const) {
      const pixels = solidPixels(rgb[0], rgb[1], rgb[2]);
      const result = pickOverlayToneFromRegion(pixels, "pill");
      expect(["light", "dark"]).toContain(result.tone);
      expect(result.contrast).toBeGreaterThan(0);
    }
  });
});

describe("relativeLuminance", () => {
  it("white is brighter than black", () => {
    expect(relativeLuminance(255, 255, 255)).toBeGreaterThan(relativeLuminance(0, 0, 0));
  });
});
