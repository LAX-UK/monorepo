import { describe, expect, it } from "vitest";
import { type PayProgressFacts, payProgressOf } from "./pay-progress.js";

const LOTS = [
  { lotId: "a", title: "Harbour", lotNumber: 1, saleTitle: "Autumn", totalPence: 525_000 },
  { lotId: "b", title: "Study", lotNumber: 2, saleTitle: "Autumn", totalPence: 645_100 },
];

const BASE: PayProgressFacts = {
  rail: "gb_bank_transfer",
  status: "open",
  checkoutFinished: true,
  totalPence: 1_170_100,
  receivedPence: 0,
  lots: LOTS,
  invoiceCount: 2,
};

describe("payProgressOf", () => {
  it("is nothing while the payer has not finished the checkout", () => {
    expect(payProgressOf({ ...BASE, checkoutFinished: false })).toBeNull();
  });

  it("a card payment that was submitted is being confirmed", () => {
    expect(payProgressOf({ ...BASE, rail: "card" })).toMatchObject({
      rail: "card",
      stage: "confirming",
    });
  });

  it("a bank transfer chosen but not yet funded is waiting for the money", () => {
    expect(payProgressOf(BASE)).toEqual({
      rail: "bank_transfer",
      stage: "awaiting_transfer",
      lots: LOTS,
      otherInvoices: 0,
      totalPence: 1_170_100,
      receivedPence: 0,
      remainingPence: 1_170_100,
      receivedPercent: 0,
    });
  });

  it("a part-funded transfer shows what is received and what is left, in whole pence", () => {
    expect(payProgressOf({ ...BASE, status: "processing", receivedPence: 600_000 })).toMatchObject({
      stage: "part_received",
      receivedPence: 600_000,
      remainingPence: 570_100,
      receivedPercent: 51,
    });
  });

  it("never rounds a transfer that is a penny short up to complete", () => {
    expect(
      payProgressOf({ ...BASE, status: "processing", receivedPence: 1_170_099 }),
    ).toMatchObject({ remainingPence: 1, receivedPercent: 99 });
  });

  it("counts the invoices of the payment that the link does not name", () => {
    expect(payProgressOf({ ...BASE, invoiceCount: 5 })?.otherInvoices).toBe(3);
    expect(payProgressOf({ ...BASE, invoiceCount: 1 })?.otherInvoices).toBe(0);
  });

  it("clamps money beyond the total, so the remainder is never negative", () => {
    expect(
      payProgressOf({ ...BASE, status: "processing", receivedPence: 2_000_000 }),
    ).toMatchObject({ receivedPence: 1_170_100, remainingPence: 0, receivedPercent: 100 });
  });

  it("holds a processing group even when the checkout flag is unknown", () => {
    expect(
      payProgressOf({ ...BASE, status: "processing", checkoutFinished: false }),
    ).not.toBeNull();
  });
});
