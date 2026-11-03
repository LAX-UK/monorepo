import { describe, expect, it } from "vitest";
import { deepFieldFromMean, paleFieldFromMean, readImageFacts } from "./home-image-facts";

describe("paleFieldFromMean", () => {
  it("is pale for any print, so dark type passes on it", () => {
    for (const mean of [
      [0, 0, 0],
      [255, 255, 255],
      [200, 30, 30],
    ] as const) {
      const hex = paleFieldFromMean(mean);
      const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
      expect(Math.min(...channels)).toBeGreaterThanOrEqual(0xcc);
    }
  });

  it("carries the print's own hue", () => {
    const [r, , b] = [1, 3, 5].map((i) =>
      Number.parseInt(paleFieldFromMean([220, 120, 40]).slice(i, i + 2), 16),
    );
    expect(r).toBeGreaterThan(b ?? 0);
  });
});

describe("readImageFacts", () => {
  it("reads each address once and leaves out what could not be read", async () => {
    const seen: string[] = [];
    const facts = await readImageFacts(
      async (src) => {
        seen.push(src);
        return src === "/bad.webp" ? null : { width: 4, height: 5, mean: [1, 2, 3] };
      },
      ["/a.webp", "/a.webp", "/bad.webp"],
    );
    expect(seen).toEqual(["/a.webp", "/bad.webp"]);
    expect([...facts.keys()]).toEqual(["/a.webp"]);
  });
});

function luminance(hex: string): number {
  const linear = (i: number) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(1) + 0.7152 * linear(3) + 0.0722 * linear(5);
}

describe("deepFieldFromMean", () => {
  it("holds white type at AA or better for any print, from black to white", () => {
    for (const mean of [
      [0, 0, 0],
      [255, 255, 255],
      [255, 255, 0],
      [200, 30, 30],
    ] as const) {
      const contrast = 1.05 / (luminance(deepFieldFromMean(mean)) + 0.05);
      expect(contrast).toBeGreaterThanOrEqual(7);
    }
  });

  it("keeps the print's hue and is darker than the pale field", () => {
    const deep = deepFieldFromMean([220, 120, 40]);
    expect(Number.parseInt(deep.slice(1, 3), 16)).toBeGreaterThan(
      Number.parseInt(deep.slice(5, 7), 16),
    );
    expect(luminance(deep)).toBeLessThan(luminance(paleFieldFromMean([220, 120, 40])));
  });
});
