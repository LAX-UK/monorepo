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
  platformFee: "62.50",
  requiresManualReview: false,
  manualReviewReason: null,
};
const raceError = {
  message: "Failed query: insert into payment",
  cause: {
    code: "23505",
    constraint: "payment_lot_buyer_open_account_unique",
    message:
      'duplicate key value violates unique constraint "payment_lot_buyer_open_account_unique"',
  },
};

function deps(create: () => Promise<unknown>, existing: unknown) {
  return {
    payments: {
      create: vi.fn(create),
      findOpenByLotAndBuyerAccount: vi.fn().mockResolvedValue(existing),
    },
    lotFulfilmentHooks: { ensureAwaitingPayment: vi.fn().mockResolvedValue(undefined) },
  } as never;
}

describe("createOrJoinPaymentRecord (two first Pay requests at once)", () => {
  it("creates the invoice when it is the first", async () => {
    const d = deps(async () => ({ id: "pay-new" }), null);
    await expect(createOrJoinPaymentRecord(d, lot, "buyer-1", {} as never, terms)).resolves.toEqual(
      { kind: "created", payment: { id: "pay-new" } },
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

  it("any other failure is not hidden", async () => {
    const d = deps(async () => {
      throw new Error("connection reset");
    }, null);
    await expect(createOrJoinPaymentRecord(d, lot, "buyer-1", {} as never, terms)).rejects.toThrow(
      "connection reset",
    );
  });
});
