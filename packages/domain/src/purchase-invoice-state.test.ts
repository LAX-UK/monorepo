import { describe, expect, it } from "vitest";
import { invoiceDueAt, invoiceIsOwed, purchaseInvoiceState } from "./purchase-invoice-state.js";

const raisedAt = new Date("2026-11-01T10:00:00Z");
const dueAt = new Date("2026-11-08T23:59:59.999Z");
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

  it("uses the London calendar: a late summer evening counts as the next London day", () => {
    // 23:30 UTC on 1 July is 00:30 on 2 July in London (BST): due at the end of 9 July, London.
    expect(invoiceDueAt(new Date("2026-07-01T23:30:00Z"))).toEqual(
      new Date("2026-07-09T22:59:59.999Z"),
    );
    expect(invoiceDueAt(new Date("2026-07-01T22:30:00Z"))).toEqual(
      new Date("2026-07-08T22:59:59.999Z"),
    );
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
  ] as const)("a %s payment reads as %s, even past the due date", (status, expected) => {
    const late = new Date("2027-01-01T00:00:00Z");
    expect(purchaseInvoiceState({ payment: { status, raisedAt } }, late)).toEqual({
      status: expected,
      dueAt,
    });
  });
});

describe("a cancelled payment row", () => {
  it("leaves the invoice owed, due and then overdue, like a pending one", () => {
    const cancelled = { payment: { status: "cancelled", raisedAt } } as const;
    expect(purchaseInvoiceState(cancelled, new Date("2026-11-05T00:00:00Z"))).toEqual({
      status: "due",
      dueAt,
    });
    expect(purchaseInvoiceState(cancelled, new Date("2027-01-01T00:00:00Z")).status).toBe(
      "overdue",
    );
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

describe("a cancelled sale", () => {
  const raisedAt = new Date("2026-11-01T10:00:00Z");
  const now = new Date("2026-11-20T10:00:00Z");

  it("reads as a cancelled invoice, not an overdue one", () => {
    const state = purchaseInvoiceState(
      { saleCancelled: true, payment: { status: "cancelled", raisedAt } },
      now,
    );
    expect(state.status).toBe("cancelled");
    expect(state.dueAt).toEqual(new Date("2026-11-08T23:59:59.999Z"));
    expect(invoiceIsOwed(state.status)).toBe(false);
  });

  it("covers a lot that was never invoiced", () => {
    expect(purchaseInvoiceState({ saleCancelled: true, payment: null }, now).status).toBe(
      "cancelled",
    );
  });
});
