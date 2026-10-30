import type { PaymentGroupMember, PaymentGroupRecord } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import {
  PaymentGroupCheckoutService,
  type StartGroupCheckoutInput,
} from "./payment-group-checkout.service.js";

const GROUP: PaymentGroupRecord = {
  id: "group-1",
  buyerLegalEntityId: "org-1",
  createdByUserId: "payer-1",
  status: "open",
  currency: "GBP",
  totalAmount: "1000.10",
  checkoutRail: "card",
  stripeCheckoutSessionId: null,
  stripePaymentIntentId: null,
  stripeChargeId: null,
  createdAt: new Date(),
  settledAt: null,
};

const MEMBERS: PaymentGroupMember[] = [
  {
    paymentId: "pay-2",
    lotId: "lot-2",
    lotTitle: "Harbour",
    lotNumber: 2,
    amount: "600.10",
    status: "pending",
    sellerLegalEntityId: "seller-1",
  },
  {
    paymentId: "pay-3",
    lotId: "lot-3",
    lotTitle: "Study",
    lotNumber: 3,
    amount: "400.00",
    status: "pending",
    sellerLegalEntityId: "seller-1",
  },
];

const INPUT: StartGroupCheckoutInput = {
  payerUserId: "payer-1",
  buyerLegalEntityId: "org-1",
  currency: "GBP",
  total: "1000.10",
  rail: "card",
  invoices: [
    { paymentId: "pay-2", lotId: "lot-2", amount: "600.10" },
    { paymentId: "pay-3", lotId: "lot-3", amount: "400.00" },
  ],
};

function setup(
  over: {
    claim?: "claimed" | "conflict";
    accountingOk?: boolean;
    createCheckout?: ReturnType<typeof vi.fn>;
    group?: Partial<PaymentGroupRecord>;
  } = {},
) {
  const group = { ...GROUP, ...over.group };
  const groups = {
    claim: vi.fn(async () =>
      over.claim === "conflict"
        ? { kind: "conflict" as const }
        : { kind: "claimed" as const, group },
    ),
    listMembers: vi.fn(async () => MEMBERS),
    recordCheckout: vi.fn(async () => {}),
  };
  const gateway = {
    isConfigured: () => true,
    createCheckout:
      over.createCheckout ??
      vi.fn(async () => ({
        sessionId: "cs_1",
        url: "https://pay.example/cs_1",
        paymentIntentId: null,
      })),
    expireCheckout: vi.fn(),
    listChargeRefunds: vi.fn(),
  };
  const singleCheckouts = { revoke: vi.fn(async () => {}) };
  const settlement = { release: vi.fn(async () => ({ processed: true })) };
  const stripeCustomers = {
    isConfigured: () => true,
    findOrCreateForLegalEntity: vi.fn(async () => "cus_org"),
  };
  const svc = new PaymentGroupCheckoutService({
    groups: groups as never,
    gateway,
    stripeCustomers,
    users: {
      findById: async () => ({ id: "payer-1", email: "payer@example.com", name: "Payer" }),
    } as never,
    singleCheckouts,
    accounting: { ensureInvoices: async () => over.accountingOk ?? true },
    settlement,
    events: mockDomainEventSink(),
    webOrigin: "https://lax.example/",
  });
  return { svc, groups, gateway, singleCheckouts, settlement, stripeCustomers };
}

describe("PaymentGroupCheckoutService.start", () => {
  it("holds the invoices, closes their own checkouts, and opens one checkout for the total", async () => {
    const { svc, groups, gateway, singleCheckouts } = setup();
    const started = (await svc.start(INPUT))._unsafeUnwrap();
    expect(started).toEqual({
      paymentGroupId: "group-1",
      checkoutUrl: "https://pay.example/cs_1",
      rail: "card",
    });
    expect(groups.claim).toHaveBeenCalledWith(
      expect.objectContaining({ paymentIds: ["pay-2", "pay-3"], totalAmount: "1000.10" }),
    );
    expect(singleCheckouts.revoke).toHaveBeenCalledTimes(2);
    expect(gateway.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentGroupId: "group-1",
        totalPence: 100_010,
        stripeCustomerId: null,
        lines: [
          expect.objectContaining({ paymentId: "pay-2", amountPence: 60_010, lotNumber: 2 }),
          expect.objectContaining({ paymentId: "pay-3", amountPence: 40_000 }),
        ],
        successUrl: "https://lax.example/purchases?payment=success&paymentGroup=group-1",
      }),
    );
    expect(groups.recordCheckout).toHaveBeenCalledWith("group-1", {
      sessionId: "cs_1",
      paymentIntentId: null,
    });
  });

  it("opens a bank transfer to the account's own customer when the total needs one", async () => {
    const { svc, gateway, stripeCustomers } = setup({
      group: { checkoutRail: "gb_bank_transfer" },
    });
    await svc.start({ ...INPUT, rail: "gb_bank_transfer" });
    expect(stripeCustomers.findOrCreateForLegalEntity).toHaveBeenCalledWith(
      expect.objectContaining({ legalEntityId: "org-1" }),
    );
    expect(gateway.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ rail: "gb_bank_transfer", stripeCustomerId: "cus_org" }),
    );
  });

  it("answers a lost race with a conflict and opens nothing", async () => {
    const { svc, gateway, singleCheckouts } = setup({ claim: "conflict" });
    expect((await svc.start(INPUT))._unsafeUnwrapErr()).toBe("conflict");
    expect(singleCheckouts.revoke).not.toHaveBeenCalled();
    expect(gateway.createCheckout).not.toHaveBeenCalled();
  });

  it("lets the invoices go at once when accounting must come first and is down", async () => {
    const { svc, gateway, settlement } = setup({ accountingOk: false });
    expect((await svc.start(INPUT))._unsafeUnwrapErr()).toBe("unavailable");
    expect(gateway.createCheckout).not.toHaveBeenCalled();
    expect(settlement.release).toHaveBeenCalledWith({
      eventId: null,
      groupId: "group-1",
      reason: "accounting_unavailable",
    });
  });

  it("lets the invoices go at once when the checkout cannot be opened", async () => {
    const { svc, groups, settlement } = setup({
      createCheckout: vi.fn(async () => {
        throw new Error("provider down");
      }),
    });
    expect((await svc.start(INPUT))._unsafeUnwrapErr()).toBe("unavailable");
    expect(groups.recordCheckout).not.toHaveBeenCalled();
    expect(settlement.release).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "checkout_unavailable" }),
    );
  });
});
