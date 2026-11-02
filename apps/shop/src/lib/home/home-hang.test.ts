import { artworkSummary } from "@/test/artwork-summary.fixture";
import { describe, expect, it } from "vitest";
import { buildHomeHang, sheetAround } from "./home-hang";
import type { ShopImageFacts } from "./home-image-facts";

const facts = (width: number, height: number): ShopImageFacts => ({
  width,
  height,
  mean: [100, 100, 100],
});

const edition = (slug: string, over = {}) =>
  artworkSummary({ slug, title: slug, imageUrl: `/${slug}.webp`, ...over });

function hang(items: ReturnType<typeof edition>[], read: string[] = items.map((i) => i.slug)) {
  return buildHomeHang({
    editions: items,
    availableCount: items.length,
    imageSrc: (item) => item.imageUrl,
    facts: new Map(read.map((slug) => [`/${slug}.webp`, facts(800, 1000)])),
  });
}

describe("sheetAround", () => {
  it("adds an even paper margin and reports it as a share of the sheet's width", () => {
    const sheet = sheetAround({ width: 800, height: 1000 });
    expect(sheet.aspect).toBeCloseTo((800 + 128) / (1000 + 128), 5);
    expect(sheet.inset).toBeCloseTo(64 / 928, 5);
  });
});

describe("buildHomeHang", () => {
  it("hangs editions with the artist, title, price with VAT and the edition and size", () => {
    const vm = hang([edition("a", { dimensionsCmDisplay: "120 cm H × 90 cm W" }), edition("b")]);
    expect(vm?.works[0]?.label).toEqual({
      artist: "Mara Ellison",
      title: "a",
      price: "£340 with VAT",
      note: "Edition of 50 · 120 × 90 cm",
    });
    expect(vm?.works[0]?.longSideCm).toBe(120);
    expect(vm?.works[1]?.longSideCm).toBeNull();
  });

  it("is left out with fewer than two readable photographs", () => {
    expect(hang([edition("a"), edition("b")], ["a"])).toBeNull();
  });

  it("drops a duplicate and links to every edition on sale", () => {
    const a = edition("a");
    const vm = buildHomeHang({
      editions: [a, a, edition("b")],
      availableCount: 9,
      imageSrc: (item) => item.imageUrl,
      facts: new Map([
        ["/a.webp", facts(4, 5)],
        ["/b.webp", facts(4, 5)],
      ]),
    });
    expect(vm?.works.map((work) => work.slug)).toEqual(["a", "b"]);
    expect(vm?.seeAll.label).toBe("See all 9 editions");
  });
});
