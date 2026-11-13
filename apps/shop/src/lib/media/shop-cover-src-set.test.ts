import { describe, expect, it } from "vitest";
import { shopCoverSrcSet } from "./shop-cover-src-set";

describe("shopCoverSrcSet", () => {
  it("names files up to the picture's own width, each a width the image route accepts", () => {
    const set = shopCoverSrcSet("https://media.test/shop/artwork/a.jpg", 1500);
    const widths = [...set.matchAll(/ (\d+)w/g)].map((match) => Number(match[1]));
    expect(widths.length).toBeGreaterThan(1);
    for (const width of widths) {
      expect([640, 828, 1080, 1200, 1920, 2048]).toContain(width);
    }
  });

  it("names nothing for no picture", () => {
    expect(shopCoverSrcSet(null)).toBe("");
  });
});
