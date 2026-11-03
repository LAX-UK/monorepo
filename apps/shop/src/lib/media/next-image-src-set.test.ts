import { describe, expect, it } from "vitest";
import { nextImageSrcSet } from "./next-image-src-set";

describe("nextImageSrcSet", () => {
  it("lists a resized file per width, from the encoded address", () => {
    const set = nextImageSrcSet("/shop/home/a b.webp");
    expect(set.split(", ")).toHaveLength(4);
    expect(set).toContain("/_next/image?url=%2Fshop%2Fhome%2Fa%20b.webp&w=256&q=75 256w");
    expect(set.endsWith("828w")).toBe(true);
  });

  it("is empty without a picture", () => {
    expect(nextImageSrcSet("")).toBe("");
  });
});
