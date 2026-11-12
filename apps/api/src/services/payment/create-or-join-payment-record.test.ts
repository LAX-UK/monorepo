import {
  BidInvoiceLotMovedError,
  BidInvoiceTotalMismatchError,
} from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { createOrJoinPaymentRecord } from "./create-pending-for-winner.pipeline.js";

const lot = {
  id: "lot-1",
  buyerLegalEntityId: "le-buyer",
  sellerLegalEntityId: "le-seller",
} as Lot;
const terms = {
  amount: "1250.00",
  priced: {
    lines: [
      { kind: "hammer", label: "Hammer price", ratePercent: null, amountPence: 100_000 },
      {
        kind: "buyers_premium",
        label: "Buyer's premium (25%)",
        ratePercent: "25",
        amountPence: 25_000,
      },
    ],
    totalPence: 125_000,
    policyId: "flat:0.25",
    existing: null,
  },
  platformFee: "62.50",
  requiresManualReview: false,
  manualReviewReason: null,
} as unknown as Parameters<typeof createOrJoinPaymentRecord>[4];
const raceError = {
  message: "Failed query: insert into payment",
  cause: {
    code: "23505",
    constraint: "payment_lot_buyer_open_account_unique",
    message:
      'duplicate key value violates unique constraint "payment_lot_buyer_open_account_unique"',
  },
};

function deps(raise: () => Promise<unknown>, existing: unknown) {
  return {
    invoiceRaiser: { raise: vi.fn(raise) },
    payments: {
      findOpenByLotAndBuyerAccount: vi.fn().mockResolvedValue(existing),
    },
    lotFulfilmentHooks: { ensureAwaitingPayment: vi.fn().mockResolvedValue(undefined) },
  } as never;
}

describe("createOrJoinPaymentRecord (two first Pay requests at once)", () => {
  it("creates the invoice when it is the first", async () => {
    const raised = { invoice: { id: "inv-1" }, payment: { id: "pay-new" }, invoiceCreated: true };
    const d = deps(async () => raised, null);
    await expect(createOrJoinPaymentRecord(d, lot, "buyer-1", {} as never, terms)).resolves.toEqual(
      { kind: "created", raised },
    );
  });

  it("joins the invoice the other request created, instead of failing", async () => {
    const d = deps(
      async () => {
        throw raceError;
      },
      { id: "pay-raced", status: "authorized", amount: "1250.00" },
    );
    const outcome = await createOrJoinPaymentRecord(d, lot, "buyer-1", {} as never, terms);
    expect(outcome.kind).toBe("joined");
    if (outcome.kind !== "joined") return;
    expect(outcome.result.isOk()).toBe(true);
    expect(outcome.result._unsafeUnwrap()).toMatchObject({ paymentId: "pay-raced" });
  });

  it("answers a conflict, not a 500, when the live invoice has a different total", async () => {
    const d = deps(async () => {
      throw new BidInvoiceTotalMismatchError("inv-1", 125_000, 99_900);
    }, null);
    const outcome = await createOrJoinPaymentRecord(d, lot, "buyer-1", {} as never, terms);
    expect(outcome.kind).toBe("joined");
    if (outcome.kind !== "joined") return;
    expect(outcome.result._unsafeUnwrapErr()).toMatchObject({
      status: 409,
      code: "invoice_total_changed",
    });
  });

  it("answers a conflict, not a 500, when the lot was defaulted or re-awarded meanwhile", async () => {
    const d = deps(async () => {
      throw new BidInvoiceLotMovedError("lot-1");
    }, null);
    const outcome = await createOrJoinPaymentRecord(d, lot, "buyer-1", {} as never, terms);
    expect(outcome.kind).toBe("joined");
    if (outcome.kind !== "joined") return;
    expect(outcome.result._unsafeUnwrapErr()).toMatchObject({ status: 409, code: "lot_moved" });
  });

  it("any other failure is not hidden", async () => {
    const d = deps(async () => {
      throw new Error("connection reset");
    }, null);
    await expect(createOrJoinPaymentRecord(d, lot, "buyer-1", {} as never, terms)).rejects.toThrow(
      "connection reset",
    );
  });
});
