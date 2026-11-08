import { describe, expect, it } from "vitest";
import { purchaseInvoiceHref } from "./purchase-invoice";

describe("purchaseInvoiceHref", () => {
  it("is the invoice download of the lot, under its purchase", () => {
    expect(purchaseInvoiceHref("11111111-1111-4111-8111-111111111111")).toBe(
      "/purchases/11111111-1111-4111-8111-111111111111/invoice",
    );
  });

  it("keeps anything unusual in the id out of the path", () => {
    expect(purchaseInvoiceHref("a/b?c")).toBe("/purchases/a%2Fb%3Fc/invoice");
  });
});
