import { buildLaxFamilyLinks } from "@auction/lax-ecosystem";
import { describe, expect, it } from "vitest";
import { buildAccountFooterColumns } from "./account-footer.vm";

const products = buildLaxFamilyLinks({
  current: "account",
  hrefs: {
    bid: "https://lax.bid",
    art: "https://lax.art",
    shop: "https://shop.lax.bid",
    account: "/",
  },
});
const support = {
  helpCentre: "https://lax.bid/faq",
  contact: "https://lax.bid/contact",
  terms: "https://lax.bid/terms",
  privacyPolicy: "https://lax.bid/privacy",
};

describe("buildAccountFooterColumns", () => {
  it("lists the other products, then help, then legal", () => {
    const columns = buildAccountFooterColumns(products, support);
    expect(columns.map((column) => column.id)).toEqual(["lax-products", "help", "legal"]);
    const labels = columns[0]?.links.map((link) => link.label);
    expect(labels).toEqual(expect.arrayContaining(["lax.bid", "lax.shop", "lax.art"]));
    expect(labels).not.toContain("LAX Account");
    expect(columns[2]?.links).toEqual([
      { label: "Terms", href: "https://lax.bid/terms" },
      { label: "Privacy", href: "https://lax.bid/privacy" },
    ]);
  });

  it("leaves out help and legal when the policies' home is unknown", () => {
    expect(buildAccountFooterColumns(products, null).map((column) => column.id)).toEqual([
      "lax-products",
    ]);
  });

  it("is empty when nothing is configured", () => {
    expect(buildAccountFooterColumns([], null)).toEqual([]);
  });
});
