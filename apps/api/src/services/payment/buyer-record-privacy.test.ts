import { describe, expect, it, vi } from "vitest";
import { BuyerPaymentHttpApplicationService } from "../finance/buyer-payment-http-application.service.js";
import { LotFulfilmentBuyerService } from "../lot-fulfilment/lot-fulfilment-buyer.service.js";
import type { LotFulfilmentContext } from "../lot-fulfilment/lot-fulfilment-context.js";
import { validatePayerCanPay } from "./create-pending-for-winner.pipeline.js";
import { cancelPendingAsBuyer } from "./payment-buyer-ops.js";
import type { PaymentServiceDeps } from "./payment-service-types.js";

/**
 * A buyer asking about someone else's purchase gets the same answer as for one that does not
 * exist: 404, never 403, so the record is not confirmed to exist.
 */

const LOT_ID = "40000000-0000-4000-8000-000000000001";
const PAYMENT_ID = "40000000-0000-4000-8000-0000000000c1";

describe("cancelling a pending payment", () => {
  const payment = { id: PAYMENT_ID, paidByUserId: "buyer-1", status: "pending" };
  const deps = () =>
    ({
      payments: {
        findById: vi.fn(async (id: string) => (id === PAYMENT_ID ? payment : null)),
        updateStatus: vi.fn(),
      },
    }) as unknown as PaymentServiceDeps;

  it("answers someone else's payment exactly like a missing one", async () => {
    const d = deps();
    const theirs = (await cancelPendingAsBuyer(d, "someone-else", PAYMENT_ID))._unsafeUnwrapErr();
    const missing = (await cancelPendingAsBuyer(d, "someone-else", "nope"))._unsafeUnwrapErr();
    expect({ status: theirs.status, message: theirs.message }).toEqual({
      status: 404,
      message: "Payment not found",
    });
    expect({ status: missing.status, message: missing.message }).toEqual({
      status: theirs.status,
      message: theirs.message,
    });
    expect(d.payments.updateStatus).not.toHaveBeenCalled();
  });
});

describe("paying for a lot", () => {
  const lot = { id: LOT_ID, status: "ended", winnerId: "winner", buyerLegalEntityId: "acc" };
  const deps = (reason: "not_winner" | "not_member" | "not_payer") =>
    ({
      lots: { findById: vi.fn(async () => lot) },
      buyerPaymentAuthority: { canPay: vi.fn(async () => ({ allowed: false, reason })) },
    }) as unknown as PaymentServiceDeps;

  it.each(["not_winner", "not_member"] as const)(
    "answers %s as not found, so someone else's purchase is not confirmed",
    async (reason) => {
      const error = (
        await validatePayerCanPay(deps(reason), "stranger", LOT_ID)
      )._unsafeUnwrapErr();
      expect(error.status).toBe(404);
      expect(error.message).toBe("Purchase not found");
      expect(error).toMatchObject({ code: "purchase_not_found" });
    },
  );

  it("still tells a member of the buying account why they may not pay", async () => {
    const error = (
      await validatePayerCanPay(deps("not_payer"), "viewer", LOT_ID)
    )._unsafeUnwrapErr();
    expect(error.status).toBe(403);
    expect(error).toMatchObject({ code: "not_organisation_payer" });
  });
});

describe("following a lot's delivery", () => {
  const service = (canPay: boolean) =>
    new LotFulfilmentBuyerService({
      lotRepo: {
        findById: vi.fn(async (id: string) =>
          id === LOT_ID ? { id, winnerId: "winner", buyerAccountKind: "individual" } : null,
        ),
      },
      fulfilmentRepo: { findByLotId: vi.fn(async () => null) },
      paymentAuthority: {
        canPay: vi.fn(async () => (canPay ? { allowed: true } : { allowed: false })),
      },
    } as unknown as LotFulfilmentContext);

  it("answers someone else's lot exactly like a missing one", async () => {
    const theirs = (await service(false).getForWinner("stranger", LOT_ID))._unsafeUnwrapErr();
    const missing = (await service(false).getForWinner("stranger", "nope"))._unsafeUnwrapErr();
    expect(theirs).toEqual({ message: "Lot not found", status: 404 });
    expect(missing).toEqual(theirs);
  });

  it("opens for the winner", async () => {
    expect((await service(false).getForWinner("winner", LOT_ID)).isOk()).toBe(true);
  });
});

describe("source of funds documents", () => {
  function submitFailing(message: string) {
    const documents = {
      submitDocuments: vi.fn(async () => {
        throw new Error(message);
      }),
    };
    return new BuyerPaymentHttpApplicationService(
      {} as never,
      documents as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      false,
    ).submitSourceOfFundsDocuments({ buyerUserId: "stranger", caseId: "case-1" });
  }

  it("answers someone else's case exactly like a missing one", async () => {
    const theirs = await submitFailing("source_of_funds_forbidden");
    const missing = await submitFailing("source_of_funds_not_found");
    expect(theirs).toEqual({ ok: false, status: 404, error: "source_of_funds_not_found" });
    expect(missing).toEqual(theirs);
  });
});
