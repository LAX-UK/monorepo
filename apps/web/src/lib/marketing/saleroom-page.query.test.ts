import type { Sale } from "@auction/types";
import { describe, expect, it } from "vitest";
import { canonicalSalePathWithQuery } from "./saleroom-page.query";

const sale = {
  id: "sale-1",
  title: "Summer Sale",
} as unknown as Sale;

describe("canonicalSalePathWithQuery", () => {
  it("preserves catalog state and marketing passthrough parameters", () => {
    const path = canonicalSalePathWithQuery(sale, {
      page: "2",
      view: "grid",
      utm_source: "newsletter",
      gclid: "TeSter-123",
      _gl: "1*abc",
      gclsrc: "aw.ds",
      gad_source: "1",
    });

    expect(path).toBe(
      "/sales/summer-sale/sale-1?page=2&view=grid&utm_source=newsletter&gclid=TeSter-123&_gl=1*abc&gclsrc=aw.ds&gad_source=1",
    );
  });

  it("drops redirect-only UI and untrusted query parameters", () => {
    const path = canonicalSalePathWithQuery(sale, {
      tab: "overview",
      q: "hidden",
      returnTo: "https://evil.example",
    });

    expect(path).toBe("/sales/summer-sale/sale-1");
  });
});
