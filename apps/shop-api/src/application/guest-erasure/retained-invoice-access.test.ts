import type { AdminOrderDetail } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { withRetainedInvoiceAccess } from "./retained-invoice-access.js";

const detail = {
  orderId: "o-1",
  retainedInvoiceContact: { name: "Ana Collector", addressLines: ["12 Elm Row", "London"] },
} as unknown as AdminOrderDetail;

describe("withRetainedInvoiceAccess", () => {
  it("keeps the invoice name and address for staff who handle invoices", () => {
    expect(withRetainedInvoiceAccess(detail, true).retainedInvoiceContact).toEqual({
      name: "Ana Collector",
      addressLines: ["12 Elm Row", "London"],
    });
  });

  it("leaves them out for everyone else", () => {
    expect(withRetainedInvoiceAccess(detail, false).retainedInvoiceContact).toBeNull();
  });
});
