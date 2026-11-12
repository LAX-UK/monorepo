import { describe, expect, it } from "vitest";
import { INVOICE_NOT_RAISED_PREFIX, invoiceSweepOutcome } from "./reoffer-invoice-outcome.js";

describe("invoiceSweepOutcome", () => {
  it("treats a created invoice as the only progress", () => {
    expect(invoiceSweepOutcome({ created: true })).toEqual({ kind: "raised" });
  });

  it.each([
    "lot_not_found",
    "lot_not_ended",
    "no_winner",
    "missing_buyer_legal_entity",
    "missing_seller_legal_entity",
    "payment_already_exists",
    "already_refunded",
    "payment_amount_exceeds_limit",
    "invalid_payment_amount",
    "lot_moved",
    "some_future_reason",
  ])("treats %s as terminal and marks it", (reason) => {
    expect(invoiceSweepOutcome({ created: false, reason })).toEqual({
      kind: "terminal",
      reason,
      marker: `${INVOICE_NOT_RAISED_PREFIX}${reason}`,
    });
  });

  it("names an unexplained refusal and keeps the marker within the column", () => {
    expect(invoiceSweepOutcome({ created: false })).toMatchObject({ reason: "unchanged" });
    const long = invoiceSweepOutcome({ created: false, reason: "x".repeat(5000) });
    expect(long.kind === "terminal" && long.marker.length).toBe(1000);
  });
});
