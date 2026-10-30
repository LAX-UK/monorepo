import { describe, expect, it } from "vitest";
import { invoiceDueAt, invoiceIsOwed, purchaseInvoiceState } from "./purchase-invoice-state.js";

const raisedAt = new Date("2026-11-01T10:00:00Z");
const dueAt = new Date("2026-11-08T10:00:00Z");
const pending = { payment: { status: "pending" as const, raisedAt } };

describe("purchaseInvoiceState", () => {
  it("is not invoiced while no payment row exists", () => {
    expect(purchaseInvoiceState({ payment: null }, raisedAt)).toEqual({
      status: "not_invoiced",
      dueAt: null,
    });
  });

  it("falls due seven days after the invoice is raised", () => {
    expect(invoiceDueAt(raisedAt)).toEqual(dueAt);
    expect(purchaseInvoiceState(pending, new Date("2026-11-05T00:00:00Z"))).toEqual({
      status: "due",
      dueAt,
    });
  });

  it("is still due at the due moment and overdue just after", () => {
    expect(purchaseInvoiceState(pending, dueAt).status).toBe("due");
    expect(purchaseInvoiceState(pending, new Date(dueAt.getTime() + 1)).status).toBe("overdue");
  });

  it.each([
    ["authorized", "processing"],
    ["requires_manual_review", "processing"],
    ["captured", "paid"],
    ["refunded", "refunded"],
    ["cancelled", "cancelled"],
  ] as const)("a %s payment reads as %s, even past the due date", (status, expected) => {
    const late = new Date("2027-01-01T00:00:00Z");
    expect(purchaseInvoiceState({ payment: { status, raisedAt } }, late)).toEqual({
      status: expected,
      dueAt,
    });
  });
});

describe("invoiceIsOwed", () => {
  it("owes due, overdue and not-yet-invoiced purchases only", () => {
    expect(invoiceIsOwed("due")).toBe(true);
    expect(invoiceIsOwed("overdue")).toBe(true);
    expect(invoiceIsOwed("not_invoiced")).toBe(true);
    for (const s of ["processing", "paid", "refunded", "cancelled"] as const) {
      expect(invoiceIsOwed(s)).toBe(false);
    }
  });
});
