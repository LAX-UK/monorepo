import { shopMegaMenuSectionActive } from "@/components/header/shop-mega-menu-active";
import { describe, expect, it } from "vitest";

describe("shopMegaMenuSectionActive", () => {
  const collect = {
    href: "/artworks",
    items: [
      { href: "/artworks", label: "All artworks" },
      { href: "/categories", label: "Shop by category" },
    ],
  };

  it("marks Collect active on artwork and category catalogue routes", () => {
    expect(shopMegaMenuSectionActive("/artworks", collect)).toBe(true);
    expect(shopMegaMenuSectionActive("/artworks/vessel-study", collect)).toBe(true);
    expect(shopMegaMenuSectionActive("/categories/prints", collect)).toBe(true);
    expect(shopMegaMenuSectionActive("/artists", collect)).toBe(false);
    expect(shopMegaMenuSectionActive("/", collect)).toBe(false);
  });
});
