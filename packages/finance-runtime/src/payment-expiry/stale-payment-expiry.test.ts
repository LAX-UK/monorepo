import { describe, expect, it, vi } from "vitest";
import type { ProviderMoneyState } from "./provider-money-state.js";
import { type StalePaymentExpiryDeps, expireStalePayments } from "./stale-payment-expiry.js";

const NOW = new Date("2026-11-05T12:00:00.000Z");
const row = { id: "pay-1", lotId: "lot-1", buyerId: "buyer-1" };

function build(
  state: ProviderMoneyState,
  current: { status?: string; paymentGroupId?: string | null } = {},
) {
  const cancelIfUnpaid = vi.fn().mockResolvedValue(true);
  const markAuthorizedIfPending = vi.fn().mockResolvedValue(true);
  const recordPaid = vi.fn().mockResolvedValue(undefined);
  const publishCancelled = vi.fn().mockResolvedValue(undefined);
  const closeAndRead = vi.fn().mockResolvedValue(state);
  const listStaleAuthorizedBefore = vi.fn().mockResolvedValue([]);
  const deps: StalePaymentExpiryDeps = {
    payments: {
      listStalePendingBefore: vi.fn().mockResolvedValue([row]),
      listStaleAuthorizedBefore,
      findForExpiry: vi.fn().mockResolvedValue({
        status: current.status ?? "pending",
        amountPence: 125_000,
        stripePaymentIntentId: null,
        paymentGroupId: current.paymentGroupId ?? null,
        buyerLegalEntityId: "le-1",
      }),
      checkoutSessionIds: vi.fn().mockResolvedValue(["cs_1"]),
      databaseNow: vi.fn().mockResolvedValue(new Date("2026-11-05T11:59:59.000Z")),
      cancelIfUnpaid,
      markAuthorizedIfPending,
    },
    provider: { closeAndRead },
    latePayments: { recordPaid },
    events: { publishCancelled },
    now: () => NOW,
  };
  return {
    deps,
    cancelIfUnpaid,
    markAuthorizedIfPending,
    recordPaid,
    publishCancelled,
    closeAndRead,
    listStaleAuthorizedBefore,
  };
}

describe("expireStalePayments", () => {
  it("cancels only after every checkout is closed and no money was taken", async () => {
    const t = build({ kind: "no_money" });
    const report = await expireStalePayments(t.deps, 14, 30);
    expect(t.closeAndRead).toHaveBeenCalledWith({
      paymentId: "pay-1",
      paymentIntentId: null,
      checkoutSessionIds: ["cs_1"],
    });
    // The check start comes from the database clock, not the app's.
    expect(t.cancelIfUnpaid).toHaveBeenCalledWith("pay-1", new Date("2026-11-05T11:59:59.000Z"));
    expect(t.publishCancelled).toHaveBeenCalledWith({
      paymentId: "pay-1",
      lotId: "lot-1",
      buyerUserId: "buyer-1",
      reason: "stale_pending_expired",
    });
    expect(report).toEqual({ expired: 1, recordedPaid: 0, keptInFlight: 0, retryLater: 0 });
    expect(t.closeAndRead.mock.invocationCallOrder[0]).toBeLessThan(
      t.cancelIfUnpaid.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("money Stripe shows as paid is recorded, never cancelled", async () => {
    const paid = {
      kind: "paid",
      paymentIntentId: "pi_1",
      chargeId: "ch_1",
      amountReceivedPence: 125_000,
    } as const;
    const t = build(paid);
    const report = await expireStalePayments(t.deps, 14, 30);
    expect(t.cancelIfUnpaid).not.toHaveBeenCalled();
    expect(t.recordPaid).toHaveBeenCalledWith({
      paymentId: "pay-1",
      amountPence: 125_000,
      buyerLegalEntityId: "le-1",
      state: paid,
    });
    expect(report.recordedPaid).toBe(1);
  });

  it.each([
    ["processing", "processing"],
    ["a transfer received in part", "transfer_part_funded"],
  ] as const)("money on its way (%s) keeps the invoice open and marks it", async (_n, reason) => {
    const t = build({ kind: "in_flight", paymentIntentId: "pi_1", reason });
    const report = await expireStalePayments(t.deps, 14, 30);
    expect(t.cancelIfUnpaid).not.toHaveBeenCalled();
    expect(t.markAuthorizedIfPending).toHaveBeenCalledWith("pay-1");
    expect(report.keptInFlight).toBe(1);
  });

  it("when Stripe cannot be asked, nothing is cancelled; the next run tries again", async () => {
    const t = build({ kind: "unknown", error: "stripe down" });
    const report = await expireStalePayments(t.deps, 14, 30);
    expect(t.cancelIfUnpaid).not.toHaveBeenCalled();
    expect(t.publishCancelled).not.toHaveBeenCalled();
    expect(report.retryLater).toBe(1);
  });

  it("a payment the webhook settled meanwhile is left alone", async () => {
    const t = build({ kind: "no_money" }, { status: "captured" });
    await expireStalePayments(t.deps, 14, 30);
    expect(t.closeAndRead).not.toHaveBeenCalled();
    expect(t.cancelIfUnpaid).not.toHaveBeenCalled();
  });

  it("an invoice in a Pay several group is released with its group, not here", async () => {
    const t = build({ kind: "no_money" }, { paymentGroupId: "grp-1" });
    await expireStalePayments(t.deps, 14, 30);
    expect(t.closeAndRead).not.toHaveBeenCalled();
  });

  it("no event when the guarded cancel finds the invoice already moved on", async () => {
    const t = build({ kind: "no_money" });
    t.cancelIfUnpaid.mockResolvedValue(false);
    const report = await expireStalePayments(t.deps, 14, 30);
    expect(t.publishCancelled).not.toHaveBeenCalled();
    expect(report.expired).toBe(0);
  });

  it("reads authorised invoices from their own, longer age", async () => {
    const t = build({ kind: "no_money" });
    await expireStalePayments(t.deps, 14, 30);
    expect(t.listStaleAuthorizedBefore).toHaveBeenCalledWith(new Date("2026-10-06T12:00:00.000Z"));
  });

  it("never expires an invoice before its 7-day due date, even if configured shorter", async () => {
    const t = build({ kind: "no_money" });
    const listStalePendingBefore = t.deps.payments.listStalePendingBefore as ReturnType<
      typeof vi.fn
    >;
    await expireStalePayments(t.deps, 2, 3);
    expect(listStalePendingBefore).toHaveBeenCalledWith(new Date("2026-10-29T12:00:00.000Z"));
    expect(t.listStaleAuthorizedBefore).toHaveBeenCalledWith(new Date("2026-10-29T12:00:00.000Z"));
  });
});
