import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { describe, expect, it } from "vitest";
import { BID_COOKIE_PREFERENCES_HREF, buildBidFooterColumns } from "./footer-link-groups";

const shop: LaxProductLinkVm = {
  id: "shop",
  label: "LAX Shop",
  href: "https://shop.example/",
  current: false,
  external: true,
};

describe("buildBidFooterColumns", () => {
  it("orders navigation, LAX products, then legal", () => {
    expect(buildBidFooterColumns([shop]).map((column) => column.id)).toEqual([
      "auctions",
      "services",
      "company",
      "lax-products",
      "legal",
    ]);
    expect(buildBidFooterColumns([]).map((column) => column.id)).not.toContain("lax-products");
  });

  it("ends the legal column with cookie settings", () => {
    const legal = buildBidFooterColumns([]).find((column) => column.id === "legal");
    expect(legal?.links.map((link) => link.label)).toEqual([
      "Legal and policies",
      "Terms",
      "Privacy",
      "Cookies",
      "Cookie settings",
    ]);
    expect(legal?.links.at(-1)?.href).toBe(BID_COOKIE_PREFERENCES_HREF);
  });
});
