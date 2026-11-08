import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";
import { bidCardSrcSet, bidCoverSrcSet, bidThumbSrcSet } from "./bid-image-src-set";

const widthsOf = (set: string) => [...set.matchAll(/&w=(\d+)&/g)].map((match) => Number(match[1]));

// The image route answers 400 to any width outside these two lists, so every ladder must sit in them.
const allowed = new Set([
  ...(nextConfig.images?.deviceSizes ?? []),
  ...(nextConfig.images?.imageSizes ?? []),
]);

describe("Bid image ladders", () => {
  it("only name widths the image route allows", () => {
    const src = "https://lax-media.lon1.cdn.digitaloceanspaces.com/a.jpg";
    for (const set of [bidCardSrcSet(src), bidThumbSrcSet(src), bidCoverSrcSet(src)]) {
      expect(set).not.toBe("");
      for (const width of widthsOf(set)) expect(allowed.has(width)).toBe(true);
    }
  });

  it("do not go past a picture's own width", () => {
    const widths = widthsOf(bidCardSrcSet("https://cdn.example/a.jpg", 700));
    expect(Math.max(...widths)).toBe(768);
  });

  it("leave a picture the route cannot resize as it is", () => {
    expect(bidCardSrcSet("data:image/png;base64,AAAA")).toBe("");
    expect(bidThumbSrcSet(null)).toBe("");
  });
});
