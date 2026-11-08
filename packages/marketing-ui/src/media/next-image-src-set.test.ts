import { describe, expect, it } from "vitest";
import { nextImageSrcSet } from "./next-image-src-set.js";

const WIDTHS = [256, 384, 640, 828] as const;

describe("nextImageSrcSet", () => {
  it("names one resized file per width, smallest first", () => {
    const set = nextImageSrcSet("https://cdn.example/art.jpg", [828, 256, 384]);
    expect(set).toBe(
      [
        "/_next/image?url=https%3A%2F%2Fcdn.example%2Fart.jpg&w=256&q=75 256w",
        "/_next/image?url=https%3A%2F%2Fcdn.example%2Fart.jpg&w=384&q=75 384w",
        "/_next/image?url=https%3A%2F%2Fcdn.example%2Fart.jpg&w=828&q=75 828w",
      ].join(", "),
    );
  });

  it("stops at the first width that covers the original, which is never enlarged", () => {
    const set = nextImageSrcSet("https://cdn.example/art.jpg", WIDTHS, { maxWidth: 500 });
    expect(set).toContain("w=640");
    expect(set).not.toContain("w=828");
    expect(nextImageSrcSet("https://cdn.example/a.jpg", WIDTHS, { maxWidth: 100 })).toBe(
      "/_next/image?url=https%3A%2F%2Fcdn.example%2Fa.jpg&w=256&q=75 256w",
    );
  });

  it("keeps every width when the original is larger than all of them, or its size is unknown", () => {
    expect(nextImageSrcSet("https://cdn.example/a.jpg", WIDTHS, { maxWidth: 4000 })).toContain(
      "w=828",
    );
    expect(nextImageSrcSet("https://cdn.example/a.jpg", WIDTHS, { maxWidth: null })).toContain(
      "w=828",
    );
  });

  it("serves a path on this site, and takes a quality", () => {
    expect(nextImageSrcSet("/media/a.jpg", [256], { quality: 60 })).toBe(
      "/_next/image?url=%2Fmedia%2Fa.jpg&w=256&q=60 256w",
    );
  });

  it("is empty for a picture the route cannot resize", () => {
    for (const src of [
      null,
      undefined,
      "",
      "  ",
      "data:image/png;base64,AAAA",
      "blob:x",
      "//cdn/x.jpg",
      "/logo.svg",
    ]) {
      expect(nextImageSrcSet(src, WIDTHS)).toBe("");
    }
  });
});
