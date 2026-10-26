import { shopMegaMenuSectionActive } from "@/components/header/shop-mega-menu-active";
import { describe, expect, it } from "vitest";

describe("shopMegaMenuSectionActive", () => {
  const editions = {
    href: "/artworks",
    items: [
      { href: "/artworks", label: "All editions" },
      { href: "/categories", label: "All categories" },
    ],
  };

  it("marks Editions active on artwork and category catalogue routes", () => {
    expect(shopMegaMenuSectionActive("/artworks", editions)).toBe(true);
    expect(shopMegaMenuSectionActive("/artworks/vessel-study", editions)).toBe(true);
    expect(shopMegaMenuSectionActive("/categories/prints", editions)).toBe(true);
    expect(shopMegaMenuSectionActive("/artists", editions)).toBe(false);
    expect(shopMegaMenuSectionActive("/", editions)).toBe(false);
  });
});
