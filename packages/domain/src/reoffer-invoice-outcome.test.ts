import { describe, expect, it } from "vitest";
import {
  INVOICE_NOT_RAISED_PREFIX,
  INVOICE_RETRY_PREFIX,
  RECOVERABLE_INVOICE_REASONS,
  TERMINAL_INVOICE_REASONS,
  invoiceSweepOutcome,
} from "./reoffer-invoice-outcome.js";

describe("invoiceSweepOutcome", () => {
  it("treats a created invoice as the only progress", () => {
    expect(invoiceSweepOutcome({ created: true })).toEqual({ kind: "raised" });
  });

  it("pins the two sets, and keeps them apart", () => {
    expect([...TERMINAL_INVOICE_REASONS].sort()).toEqual([
      "already_refunded",
      "lot_moved",
      "lot_not_ended",
      "lot_not_found",
      "missing_buyer_legal_entity",
      "no_winner",
      "payment_already_exists",
    ]);
    expect([...RECOVERABLE_INVOICE_REASONS].sort()).toEqual([
      "invalid_payment_amount",
      "missing_seller_legal_entity",
      "payment_amount_exceeds_limit",
      "unchanged",
    ]);
    const terminal = new Set<string>(TERMINAL_INVOICE_REASONS);
    expect(RECOVERABLE_INVOICE_REASONS.filter((r) => terminal.has(r))).toEqual([]);
  });

  it.each([...TERMINAL_INVOICE_REASONS])(
    "treats %s (an invoice exists or the award is gone) as terminal",
    (reason) => {
      expect(invoiceSweepOutcome({ created: false, reason })).toEqual({
        kind: "terminal",
        reason,
        marker: `${INVOICE_NOT_RAISED_PREFIX}${reason}`,
      });
    },
  );

  it.each([...RECOVERABLE_INVOICE_REASONS, "some_future_reason"])(
    "retries %s later, never marks it for good",
    (reason) => {
      expect(invoiceSweepOutcome({ created: false, reason })).toEqual({
        kind: "retry",
        reason,
        marker: `${INVOICE_RETRY_PREFIX}${reason}`,
      });
    },
  );

  it("retries an unexplained refusal, and keeps the marker within the column", () => {
    expect(invoiceSweepOutcome({ created: false })).toEqual({
      kind: "retry",
      reason: "unchanged",
      marker: `${INVOICE_RETRY_PREFIX}unchanged`,
    });
    const long = invoiceSweepOutcome({ created: false, reason: "x".repeat(5000) });
    expect(long.kind).toBe("retry");
    expect(long.kind !== "raised" && long.marker.length).toBe(1000);
  });
});
