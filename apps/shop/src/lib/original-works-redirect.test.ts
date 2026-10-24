import { describe, expect, it } from "vitest";
import { resolveOriginalWorksRedirect } from "./original-works-redirect";

const art = new URL("https://art.example.test");
const resolve = (path: string, artBase: URL | null = art) =>
  resolveOriginalWorksRedirect(new URL(path, "https://shop.example.test"), artBase)?.toString();

describe("resolveOriginalWorksRedirect", () => {
  it("sends the originals category to the lax.art originals listing", () => {
    expect(resolve("/categories/originals")).toBe("https://art.example.test/artworks");
    expect(resolve("/categories/originals/")).toBe("https://art.example.test/artworks");
  });

  it("sends the originals type filter to the lax.art originals listing", () => {
    expect(resolve("/artworks?type=original")).toBe("https://art.example.test/artworks");
    expect(resolve("/artworks?type=original&sort=titleAsc")).toBe(
      "https://art.example.test/artworks",
    );
  });

  it("leaves other Shop catalogue URLs alone", () => {
    expect(resolve("/artworks")).toBeUndefined();
    expect(resolve("/artworks?type=edition")).toBeUndefined();
    expect(resolve("/categories/prints")).toBeUndefined();
    expect(resolve("/artworks/some-print")).toBeUndefined();
  });

  it("does nothing when lax.art is not configured", () => {
    expect(resolve("/categories/originals", null)).toBeUndefined();
  });
});
