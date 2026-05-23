import { afterEach, describe, expect, it } from "vitest";
import { resolveMediaSrc } from "./resolve-media-src";

const originalMediaBase = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;

afterEach(() => {
  if (originalMediaBase === undefined) {
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL = undefined;
  } else {
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL = originalMediaBase;
  }
});

describe("resolveMediaSrc", () => {
  it("returns null for empty input", () => {
    expect(resolveMediaSrc(null)).toBeNull();
    expect(resolveMediaSrc(undefined)).toBeNull();
    expect(resolveMediaSrc("")).toBeNull();
    expect(resolveMediaSrc("   ")).toBeNull();
  });

  it("passes through valid absolute URLs", () => {
    expect(resolveMediaSrc("https://media.lax.bid/uploads/foo.jpg")).toBe(
      "https://media.lax.bid/uploads/foo.jpg",
    );
  });

  it("passes through root-relative paths", () => {
    expect(resolveMediaSrc("/images/placeholder.jpg")).toBe("/images/placeholder.jpg");
  });

  it("returns null for bare object keys when media base is unset", () => {
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL = undefined;
    expect(resolveMediaSrc("uploads/pending/lots/abc.jpg")).toBeNull();
  });

  it("prefixes bare keys with NEXT_PUBLIC_MEDIA_BASE_URL", () => {
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL = "https://media.lax.bid";
    expect(resolveMediaSrc("uploads/pending/lots/abc.jpg")).toBe(
      "https://media.lax.bid/uploads/pending/lots/abc.jpg",
    );
  });

  it("returns null for malformed absolute URLs", () => {
    expect(resolveMediaSrc("https://")).toBeNull();
    expect(resolveMediaSrc("http://")).toBeNull();
  });
});
