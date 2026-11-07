import type {
  BidInvoiceRecord,
  PaymentGroupMember,
  PaymentGroupRecord,
} from "@auction/persistence/interfaces";
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
  amountReceived: "0.00",
  receivedEventAt: null,
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

const invoiceOf = (id: string, lotId: string, pence: number): BidInvoiceRecord => ({
  id: `inv-${id}`,
  lotId,
  buyerLegalEntityId: "org-1",
  sellerLegalEntityId: "seller-1",
  totalPence: pence,
  raisedAt: new Date("2026-11-01T10:00:00Z"),
  dueAt: new Date("2026-11-08T23:59:59Z"),
  pricingPolicyId: null,
  number: null,
  source: "raised",
  voidedAt: null,
  lines: [{ kind: "legacy_total", label: "Total", ratePercent: null, amountPence: pence }],
});
const INVOICES: [string, BidInvoiceRecord][] = [
  ["pay-2", invoiceOf("2", "lot-2", 60_010)],
  ["pay-3", invoiceOf("3", "lot-3", 40_000)],
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
    invoices?: [string, BidInvoiceRecord][];
    earlier?: "clear" | "in_progress" | "unavailable";
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
    checkoutStatus: vi.fn(),
    bankTransferInstructions: vi.fn(),
    listChargeRefunds: vi.fn(),
  };
  const openCheckouts = { endFor: vi.fn(async () => over.earlier ?? ("clear" as const)) };
  const singleCheckouts = { revoke: vi.fn(async () => {}) };
  const settlement = { release: vi.fn(async () => ({ processed: true })) };
  const stripeCustomers = {
    isConfigured: () => true,
    findOrCreateForLegalEntity: vi.fn(async () => "cus_org"),
  };
  const invoices = { findByPaymentIds: vi.fn(async () => new Map(over.invoices ?? INVOICES)) };
  const svc = new PaymentGroupCheckoutService({
    groups: groups as never,
    invoices,
    gateway,
    stripeCustomers,
    users: {
      findById: async () => ({ id: "payer-1", email: "payer@example.com", name: "Payer" }),
    } as never,
    singleCheckouts,
    openCheckouts,
    accounting: { ensureInvoices: async () => over.accountingOk ?? true },
    settlement,
    events: mockDomainEventSink(),
    webOrigin: "https://lax.example/",
  });
  return { svc, groups, gateway, singleCheckouts, settlement, stripeCustomers, openCheckouts };
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
        successUrl: "https://lax.example/purchases/pay?lots=lot-2,lot-3&returned=success",
        cancelUrl: "https://lax.example/purchases/pay?lots=lot-2,lot-3&returned=cancelled",
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

  it("ends a checkout the payer left open before it takes the invoices", async () => {
    const { svc, groups, openCheckouts } = setup();
    await svc.start(INPUT);
    expect(openCheckouts.endFor).toHaveBeenCalledWith(["pay-2", "pay-3"]);
    expect(openCheckouts.endFor.mock.invocationCallOrder[0]).toBeLessThan(
      groups.claim.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("opens nothing while a payment for the invoices is finished or on its way", async () => {
    const { svc, groups, gateway } = setup({ earlier: "in_progress" });
    expect((await svc.start(INPUT))._unsafeUnwrapErr()).toBe("in_progress");
    expect(groups.claim).not.toHaveBeenCalled();
    expect(gateway.createCheckout).not.toHaveBeenCalled();
  });

  it("opens nothing when the earlier checkout could not be ended", async () => {
    const { svc, groups, gateway } = setup({ earlier: "unavailable" });
    expect((await svc.start(INPUT))._unsafeUnwrapErr()).toBe("unavailable");
    expect(groups.claim).not.toHaveBeenCalled();
    expect(gateway.createCheckout).not.toHaveBeenCalled();
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

  it("sends the gateway each invoice's stored lines", async () => {
    const { svc, gateway } = setup();
    await svc.start(INPUT);
    expect(gateway.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [
          expect.objectContaining({ paymentId: "pay-2", invoiceLines: INVOICES[0]?.[1].lines }),
          expect.objectContaining({ paymentId: "pay-3", invoiceLines: INVOICES[1]?.[1].lines }),
        ],
      }),
    );
  });

  it("opens no checkout when an invoice is missing, and lets the invoices go", async () => {
    const { svc, gateway, settlement } = setup({
      invoices: [INVOICES[0] as [string, BidInvoiceRecord]],
    });
    expect((await svc.start(INPUT))._unsafeUnwrapErr()).toBe("unavailable");
    expect(gateway.createCheckout).not.toHaveBeenCalled();
    expect(settlement.release).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "checkout_unavailable" }),
    );
  });

  it("opens no checkout when an invoice total differs from its payment amount", async () => {
    const stale: [string, BidInvoiceRecord] = ["pay-3", invoiceOf("3", "lot-3", 39_999)];
    const { svc, gateway } = setup({
      invoices: [INVOICES[0] as [string, BidInvoiceRecord], stale],
    });
    expect((await svc.start(INPUT))._unsafeUnwrapErr()).toBe("unavailable");
    expect(gateway.createCheckout).not.toHaveBeenCalled();
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
