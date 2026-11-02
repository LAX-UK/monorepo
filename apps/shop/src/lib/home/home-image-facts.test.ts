import { describe, expect, it } from "vitest";
import { paleFieldFromMean, readImageFacts } from "./home-image-facts";

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
