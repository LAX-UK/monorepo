import type { DealClearanceSnapshot } from "@auction/domain";
import { describe, expect, it, vi } from "vitest";
import { PaymentTierPolicy } from "../payment/payment-tier.policy.js";
import {
  InMemoryDealPayments,
  makeDeal,
  makePayment,
  recordingSink,
} from "./deal-fixtures.test-util.js";
import { DealPaymentService } from "./deal-payment.service.js";

const CLEAR: DealClearanceSnapshot = {
  seller: { kyc: "clear", aml: "clear" },
  buyer: { kyc: "clear", aml: "clear" },
  buyerSourceOfFunds: "approved",
  buyerOtherOpenExposureMinor: 0,
};

const tiers = new PaymentTierPolicy({
  cardMaxPence: 1_000_000,
  manualReviewMinPence: 50_000_000,
  absoluteMaxPence: 99_999_999,
  minPence: 30,
});

function setup(
  over: {
    deal?: ReturnType<typeof makeDeal> | null;
    payments?: InMemoryDealPayments;
    clearance?: DealClearanceSnapshot;
    configured?: boolean;
    checkoutFails?: boolean;
  } = {},
) {
  const payments = over.payments ?? new InMemoryDealPayments();
  const events = recordingSink();
  const createCheckout = vi.fn(async (input: { paymentId: string }) => {
    if (over.checkoutFails) throw new Error("stripe down");
    return { sessionId: "cs_1", url: `https://pay.test/${input.paymentId}`, paymentIntentId: null };
  });
  const service = new DealPaymentService({
    deals: { findById: async () => (over.deal === undefined ? makeDeal() : over.deal) },
    payments,
    clearance: { snapshot: async () => over.clearance ?? CLEAR },
    tiers,
    gateway: {
      isConfigured: () => over.configured ?? true,
      createCheckout,
      expireCheckout: async () => undefined,
      checkoutStatus: async () => "expired" as const,
    },
    stripeCustomers: { isConfigured: () => true, findOrCreateForLegalEntity: async () => "cus_1" },
    users: { findById: async () => ({ email: "buyer@test.dev", name: "Buyer" }) } as never,
    events,
    webOrigin: "https://lax.test",
  });
  return { service, payments, events, createCheckout };
}

const start = { dealId: "deal-1", payerUserId: "u-buyer" };

describe("DealPaymentService.start", () => {
  it("opens a bank transfer checkout above the card limit for the price plus fee", async () => {
    const { service, createCheckout, events, payments } = setup();
    const result = await service.start(start);
    expect(result).toMatchObject({
      ok: true,
      started: { rail: "gb_bank_transfer", amountMinor: 4_800_000 },
    });
    expect(createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        amountPence: 4_800_000,
        reference: "PS-0001",
        stripeCustomerId: "cus_1",
        successUrl: "https://lax.test/purchases?payment=success&privateSale=PS-0001",
      }),
    );
    expect(payments.rows[0]?.stripeCheckoutSessionId).toBe("cs_1");
    expect(events.events[0]).toMatchObject({ eventType: "private_sale_deal.payment_started" });
  });

  it("charges the buyer's fee on top of the price, and pays by card under the limit", async () => {
    const { service, createCheckout } = setup({
      deal: makeDeal({ priceMinor: 500_000, buyerFeeBps: 200 }),
    });
    const result = await service.start(start);
    expect(result).toMatchObject({ ok: true, started: { rail: "card", amountMinor: 510_000 } });
    expect(createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ rail: "card", stripeCustomerId: null }),
    );
  });

  it("returns the checkout already open instead of a second payment", async () => {
    const { service, payments } = setup();
    await service.start(start);
    const again = await service.start(start);
    expect(again.ok).toBe(true);
    expect(payments.rows).toHaveLength(1);
  });

  it("says a paid deal is paid and a bank transfer on its way is in progress", async () => {
    const paid = setup({ payments: new InMemoryDealPayments([makePayment({ status: "paid" })]) });
    expect(await paid.service.start(start)).toEqual({ ok: false, error: { kind: "already_paid" } });
    const moving = setup({
      payments: new InMemoryDealPayments([makePayment({ status: "processing" })]),
    });
    expect(await moving.service.start(start)).toEqual({
      ok: false,
      error: { kind: "in_progress" },
    });
  });

  it("lets only the person acting for the buyer pay", async () => {
    const { service, createCheckout } = setup();
    expect(await service.start({ ...start, payerUserId: "u-other" })).toEqual({
      ok: false,
      error: { kind: "forbidden" },
    });
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it.each(["agreed", "cleared", "paid", "released", "cancelled"] as const)(
    "does not take payment in the %s stage",
    async (stage) => {
      const { service } = setup({ deal: makeDeal({ stage }) });
      expect(await service.start(start)).toMatchObject({
        ok: false,
        error: { kind: "blocked", blockers: [{ code: "deal_not_invoiced" }] },
      });
    },
  );

  it("takes no money while the buyer's checks are not clear", async () => {
    const { service, createCheckout } = setup({
      clearance: { ...CLEAR, buyer: { kyc: "clear", aml: "review" } },
    });
    expect(await service.start(start)).toEqual({ ok: false, error: { kind: "compliance_hold" } });
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it("leaves amounts at or above the manual review amount to finance", async () => {
    const { service } = setup({ deal: makeDeal({ priceMinor: 60_000_000 }) });
    expect(await service.start(start)).toEqual({
      ok: false,
      error: { kind: "not_payable_online" },
    });
  });

  it("lets the payment go when the checkout cannot be opened, so the buyer can retry", async () => {
    const { service, payments } = setup({ checkoutFails: true });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await service.start(start)).toEqual({ ok: false, error: { kind: "unavailable" } });
    expect(payments.rows[0]?.status).toBe("cancelled");
    expect(await payments.findLiveForDeal("deal-1")).toBeNull();
  });

  it("reports an unknown deal", async () => {
    const { service } = setup({ deal: null });
    expect(await service.start(start)).toEqual({ ok: false, error: { kind: "not_found" } });
  });
});
