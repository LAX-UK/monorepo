import { internationalQuoteMailto } from "@/lib/international-quote-mailto";
import type { BasketView } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";

const line: BasketView["lines"][number] = {
  lineId: "l1",
  artworkSlug: "harbor-print",
  artworkTitle: "Harbor Print",
  productVariantId: null,
  productSlug: null,
  productTitle: null,
  variantSku: null,
  quantity: 2,
  unitPricePence: 8500,
  soldOut: false,
  priceChanged: false,
  outOfStock: false,
  imageUrl: null,
};

describe("internationalQuoteMailto", () => {
  it("prefills the basket contents and reference", () => {
    const href = internationalQuoteMailto("help@example.com", {
      basketId: "b1",
      lines: [
        line,
        { ...line, lineId: "l2", productTitle: "Tote", variantSku: "TOTE-1", quantity: 1 },
      ],
      merchandiseSubtotalPence: 25500,
      expiresAt: "2026-01-01T00:00:00.000Z",
    });
    const url = new URL(href);
    expect(url.protocol).toBe("mailto:");
    expect(url.pathname).toBe("help@example.com");
    expect(url.search).not.toContain("+");
    expect(url.searchParams.get("subject")).toBe("International delivery quotation");
    const body = url.searchParams.get("body") ?? "";
    expect(body).toContain("- Harbor Print × 2");
    expect(body).toContain("- Tote (SKU TOTE-1) × 1");
    expect(body).toContain("Basket reference: b1");
  });
});
