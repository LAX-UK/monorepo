import type { PaymentEligibility } from "@auction/domain";
import type {
  PaymentGroupDelivery,
  PaymentGroupMember,
  PaymentGroupRecord,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import {
  type PaymentGroupSettlementDeps,
  PaymentGroupSettlementService,
} from "./payment-group-settlement.service.js";

const TX = {} as never;

const group = (over: Partial<PaymentGroupRecord> = {}): PaymentGroupRecord => ({
  id: "grp_1",
  buyerLegalEntityId: "org_1",
  createdByUserId: "user_1",
  status: "processing",
  currency: "GBP",
  totalAmount: "200.00",
  checkoutRail: "gb_bank_transfer",
  stripeCheckoutSessionId: "cs_1",
  stripePaymentIntentId: "pi_1",
  stripeChargeId: null,
  amountReceived: "0.00",
  receivedEventAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  settledAt: null,
  ...over,
});

const members = (): PaymentGroupMember[] =>
  ["pay_a", "pay_b"].map((paymentId) => ({
    paymentId,
    lotId: `lot_${paymentId}`,
    lotTitle: "Work",
    lotNumber: null,
    sellerLegalEntityId: "seller_1",
    amount: "100.00",
    status: "authorized",
  }));

const money = {
  eventId: "evt_1",
  groupId: "grp_1",
  paymentIntentId: "pi_1",
  chargeId: "ch_1",
  amountPence: 20_000,
  currency: "gbp",
};

function setup(
  check: () => Promise<PaymentEligibility>,
  record = group(),
  deliveries: PaymentGroupDelivery[] = [],
) {
  const publish = vi.fn().mockResolvedValue(undefined);
  const captureInTransaction = vi.fn().mockResolvedValue({
    captured: true,
    afterCommit: async () => {},
  });
  const record$ = vi.fn().mockResolvedValue(undefined);
  const deps: PaymentGroupSettlementDeps = {
    transactionRunner: { runInTransaction: async (fn: (tx: never) => unknown) => fn(TX) } as never,
    groups: {
      findById: vi.fn().mockResolvedValue(record),
      lockInTransaction: vi
        .fn()
        .mockResolvedValue({ group: record, members: members(), deliveries }),
      transitionInTransaction: vi.fn().mockResolvedValue(true),
    } as never,
    payments: { applyAuthorizedInTransaction: vi.fn() },
    capture: { captureInTransaction } as never,
    events: mockDomainEventSink(publish),
    claims: { claim: vi.fn().mockResolvedValue(true) },
    receipt: { send: vi.fn().mockResolvedValue(undefined) },
    unappliedMoney: { record: record$ },
    eligibility: { check: vi.fn(check) },
  };
  return { service: new PaymentGroupSettlementService(deps), deps, captureInTransaction, record$ };
}

describe("PaymentGroupSettlementService.settle for accounts that cannot pay", () => {
  it.each([
    [
      "an unverified identity",
      { kind: "held", reason: "identity_verification_required" },
      "account_identity_verification_required",
    ],
    [
      "an organisation under review",
      { kind: "held", reason: "organisation_under_review" },
      "account_organisation_under_review",
    ],
    [
      "a closed organisation",
      { kind: "refused", reason: "organisation_closed" },
      "account_organisation_closed",
    ],
  ] as const)("captures nothing and opens a finance task for %s", async (_name, result, reason) => {
    const { service, captureInTransaction, record$, deps } = setup(async () => result);

    await expect(service.settle(money)).resolves.toEqual({
      processed: true,
      action: "skipped",
      reason,
    });

    expect(captureInTransaction).not.toHaveBeenCalled();
    expect(deps.groups.transitionInTransaction).not.toHaveBeenCalled();
    expect(record$).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({
        reason: "group_not_settleable",
        paymentGroupId: "grp_1",
        amountCents: 20_000,
      }),
      "org_1",
    );
  });

  it("treats a group with no recorded payer as not payable", async () => {
    const { service, captureInTransaction, record$ } = setup(
      async () => ({ kind: "payable" }),
      group({ createdByUserId: null }),
    );

    await expect(service.settle(money)).resolves.toMatchObject({
      action: "skipped",
      reason: "account_payer_unknown",
    });
    expect(captureInTransaction).not.toHaveBeenCalled();
    expect(record$).toHaveBeenCalledTimes(1);
  });

  it("settles every invoice when the account can pay", async () => {
    const { service, captureInTransaction, record$, deps } = setup(async () => ({
      kind: "payable",
    }));

    await expect(service.settle(money)).resolves.toMatchObject({
      action: "payment_intent_succeeded",
    });

    expect(deps.eligibility.check).toHaveBeenCalledWith({
      payerUserId: "user_1",
      buyerLegalEntityId: "org_1",
    });
    expect(captureInTransaction).toHaveBeenCalledTimes(2);
    expect(record$).not.toHaveBeenCalled();
  });

  describe("a payment that includes courier delivery", () => {
    const courier: PaymentGroupDelivery = {
      quoteId: "quote_1",
      lotId: "lot_pay_a",
      amount: "180.00",
    };
    const withDelivery = group({ totalAmount: "380.00" });

    it("settles every invoice when the money is the invoices and the delivery", async () => {
      const { service, captureInTransaction, record$, deps } = setup(
        async () => ({ kind: "payable" }),
        withDelivery,
        [courier],
      );
      await expect(service.settle({ ...money, amountPence: 38_000 })).resolves.toMatchObject({
        action: "payment_intent_succeeded",
      });
      expect(captureInTransaction).toHaveBeenCalledTimes(2);
      expect(record$).not.toHaveBeenCalled();
      // The receipt lists the delivery as well as the invoices.
      expect(deps.receipt.send).toHaveBeenCalledWith(
        withDelivery,
        expect.arrayContaining([expect.objectContaining({ paymentId: "pay_a" })]),
        [courier],
      );
    });

    it("captures nothing and alerts finance when only the invoices' money arrived", async () => {
      const { service, captureInTransaction, record$ } = setup(
        async () => ({ kind: "payable" }),
        withDelivery,
        [courier],
      );
      await expect(service.settle(money)).resolves.toMatchObject({
        action: "skipped",
        reason: "amount_mismatch",
      });
      expect(captureInTransaction).not.toHaveBeenCalled();
      expect(record$).toHaveBeenCalledTimes(1);
    });
  });

  it("rejects when the eligibility read fails, so the provider retries", async () => {
    const { service, captureInTransaction } = setup(async () => {
      throw new Error("db_unavailable");
    });

    await expect(service.settle(money)).rejects.toThrow("db_unavailable");
    expect(captureInTransaction).not.toHaveBeenCalled();
  });
});
