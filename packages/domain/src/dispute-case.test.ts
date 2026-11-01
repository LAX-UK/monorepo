import { describe, expect, it } from "vitest";
import {
  type DisputeCandidate,
  type DisputeFunds,
  decideDisputeAllocation,
  disputeFundsAfter,
  disputeLineEffect,
  disputeSellerSharePence,
  isDisputeAwaitingAllocation,
  isNewerDisputeSnapshot,
  isTerminalDisputeStatus,
  planAutomaticDisputeAllocation,
} from "./dispute-case.js";

const invoice = (paymentId: string, amountPence: number, platformFeePence = 0) =>
  ({
    paymentId,
    sellerLegalEntityId: `seller-${paymentId}`,
    amountPence,
    platformFeePence,
  }) satisfies DisputeCandidate;

describe("planAutomaticDisputeAllocation", () => {
  it("puts the whole disputed amount on the only invoice, as the seller's to carry", () => {
    expect(planAutomaticDisputeAllocation(5_000, [invoice("a", 10_000, 1_000)])).toEqual([
      {
        paymentId: "a",
        sellerLegalEntityId: "seller-a",
        amountPence: 5_000,
        sellerSharePence: 5_000,
      },
    ]);
  });

  it("asks the finance team when the charge paid several invoices", () => {
    expect(
      planAutomaticDisputeAllocation(20_000, [invoice("a", 10_000), invoice("b", 10_000)]),
    ).toBeNull();
  });

  it("asks the finance team when no invoice matches the charge", () => {
    expect(planAutomaticDisputeAllocation(20_000, [])).toBeNull();
  });
});

describe("isDisputeAwaitingAllocation", () => {
  it("waits while the case needs allocating and money can still be lost", () => {
    for (const status of ["needs_response", "under_review", "warning_needs_response", "lost"]) {
      expect(isDisputeAwaitingAllocation({ allocationState: "needs_allocation", status })).toBe(
        true,
      );
    }
  });

  it("leaves the queue once allocated, or when the case ended without a loss", () => {
    expect(isDisputeAwaitingAllocation({ allocationState: "allocated", status: "lost" })).toBe(
      false,
    );
    for (const status of ["won", "warning_closed", "prevented"]) {
      expect(isDisputeAwaitingAllocation({ allocationState: "needs_allocation", status })).toBe(
        false,
      );
    }
  });
});

describe("isTerminalDisputeStatus", () => {
  it("knows the statuses that end a dispute", () => {
    expect(["won", "lost", "warning_closed", "prevented"].every(isTerminalDisputeStatus)).toBe(
      true,
    );
    expect(
      ["needs_response", "under_review", "warning_under_review"].some(isTerminalDisputeStatus),
    ).toBe(false);
  });
});

describe("disputeSellerSharePence", () => {
  it("charges the seller their net share of the allocated amount", () => {
    // A £100 invoice with a £20 fee: the seller earns 80%, so carries 80% of £50.
    expect(disputeSellerSharePence(5_000, invoice("a", 10_000, 2_000))).toBe(4_000);
  });

  it("rounds in the seller's favour, so the house keeps the rounding", () => {
    expect(disputeSellerSharePence(1, invoice("a", 3, 1))).toBe(0);
    expect(disputeSellerSharePence(100, invoice("a", 300, 100))).toBe(66);
  });

  it("charges nothing on an empty invoice or one the fee swallows", () => {
    expect(disputeSellerSharePence(100, invoice("a", 0))).toBe(0);
    expect(disputeSellerSharePence(100, invoice("a", 100, 150))).toBe(0);
  });
});

describe("disputeFundsAfter", () => {
  const none: DisputeFunds = { withdrawn: false, reinstated: false };

  it("records funds withdrawn and reinstated", () => {
    expect(disputeFundsAfter("funds_withdrawn", "needs_response", none)).toEqual({
      withdrawn: true,
      reinstated: false,
    });
    expect(
      disputeFundsAfter("funds_reinstated", "won", { withdrawn: true, reinstated: false }),
    ).toEqual({
      withdrawn: true,
      reinstated: true,
    });
  });

  it("treats a won dispute's funds as returned", () => {
    expect(
      disputeFundsAfter("closed", "won", { withdrawn: true, reinstated: false }).reinstated,
    ).toBe(true);
  });

  it("leaves the funds alone on a loss or an update", () => {
    const withdrawn = { withdrawn: true, reinstated: false };
    expect(disputeFundsAfter("closed", "lost", withdrawn)).toEqual(withdrawn);
    expect(disputeFundsAfter("updated", "under_review", withdrawn)).toEqual(withdrawn);
    expect(disputeFundsAfter("created", "needs_response", none)).toEqual(none);
  });
});

describe("disputeLineEffect", () => {
  it("claws back once while the funds are withdrawn", () => {
    expect(disputeLineEffect({ withdrawn: true, reinstated: false }, "none")).toBe("withdraw");
    expect(disputeLineEffect({ withdrawn: true, reinstated: false }, "withdrawn")).toBeNull();
  });

  it("reverses once when the funds come back", () => {
    expect(disputeLineEffect({ withdrawn: true, reinstated: true }, "withdrawn")).toBe("reverse");
    expect(disputeLineEffect({ withdrawn: true, reinstated: true }, "reversed")).toBeNull();
  });

  it("never charges a seller when the funds came back first", () => {
    expect(disputeLineEffect({ withdrawn: true, reinstated: true }, "none")).toBeNull();
    expect(disputeLineEffect({ withdrawn: false, reinstated: true }, "none")).toBeNull();
  });

  it("does nothing while the funds have not moved", () => {
    expect(disputeLineEffect({ withdrawn: false, reinstated: false }, "none")).toBeNull();
  });
});

describe("isNewerDisputeSnapshot", () => {
  it("applies newer and same-second copies, never older ones", () => {
    const at = new Date("2026-11-01T10:00:00Z");
    expect(isNewerDisputeSnapshot(at, new Date("2026-11-01T10:00:01Z"))).toBe(true);
    expect(isNewerDisputeSnapshot(at, at)).toBe(true);
    expect(isNewerDisputeSnapshot(at, new Date("2026-11-01T09:59:59Z"))).toBe(false);
  });
});

describe("decideDisputeAllocation", () => {
  const invoices = [invoice("a", 10_000, 2_000), invoice("b", 20_000, 0)];
  const decide = (
    lines: { paymentId: string; amountPence: number }[],
    over: Partial<Parameters<typeof decideDisputeAllocation>[0]> = {},
  ) =>
    decideDisputeAllocation({
      disputedPence: 15_000,
      candidatePaymentIds: ["a", "b"],
      invoices,
      lines,
      ...over,
    });

  it("accepts lines that add up to the disputed amount, each with the seller's share", () => {
    expect(
      decide([
        { paymentId: "a", amountPence: 5_000 },
        { paymentId: "b", amountPence: 10_000 },
      ]),
    ).toEqual({
      ok: true,
      lines: [
        {
          paymentId: "a",
          sellerLegalEntityId: "seller-a",
          amountPence: 5_000,
          sellerSharePence: 4_000,
        },
        {
          paymentId: "b",
          sellerLegalEntityId: "seller-b",
          amountPence: 10_000,
          sellerSharePence: 10_000,
        },
      ],
    });
  });

  it("refuses an empty allocation", () => {
    expect(decide([])).toEqual({ ok: false, reason: "no_lines" });
  });

  it("refuses the same invoice twice", () => {
    expect(
      decide([
        { paymentId: "a", amountPence: 7_500 },
        { paymentId: "a", amountPence: 7_500 },
      ]),
    ).toEqual({ ok: false, reason: "duplicate_payment" });
  });

  it("refuses an invoice that does not exist", () => {
    expect(decide([{ paymentId: "zz", amountPence: 15_000 }])).toEqual({
      ok: false,
      reason: "unknown_payment",
    });
  });

  it("refuses an invoice the charge did not pay", () => {
    expect(
      decide([{ paymentId: "b", amountPence: 15_000 }], { candidatePaymentIds: ["a"] }),
    ).toEqual({ ok: false, reason: "not_a_candidate" });
  });

  it("accepts any known invoice when the charge matched none", () => {
    expect(decide([{ paymentId: "b", amountPence: 15_000 }], { candidatePaymentIds: [] }).ok).toBe(
      true,
    );
  });

  it("refuses zero, negative and fractional amounts", () => {
    for (const amountPence of [0, -5, 1.5]) {
      expect(decide([{ paymentId: "b", amountPence }])).toEqual({
        ok: false,
        reason: "amount_not_positive",
      });
    }
  });

  it("refuses more than the invoice total", () => {
    expect(decide([{ paymentId: "a", amountPence: 15_000 }])).toEqual({
      ok: false,
      reason: "exceeds_invoice",
    });
  });

  it("refuses lines that do not add up to the disputed amount", () => {
    expect(
      decide([
        { paymentId: "a", amountPence: 5_000 },
        { paymentId: "b", amountPence: 9_999 },
      ]),
    ).toEqual({ ok: false, reason: "total_mismatch" });
  });
});
