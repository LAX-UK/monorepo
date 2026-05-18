import type { Database } from "@auction/db";
import { payment } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tryClaimProcessedStripeEvent } from "../lib/stripe-processed-event.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { IPayoutRepository } from "./interfaces/payout-repository.js";
import { StripePaymentWebhookService } from "./stripe-payment-webhook.service.js";

vi.mock("../lib/stripe-processed-event.js", () => ({
  tryClaimProcessedStripeEvent: vi.fn(),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return { ...actual, eq: vi.fn(actual.eq) };
});

function mockDbWithPayment(paymentRow: {
  id: string;
  sellerLegalEntityId: string;
  status: string;
  amount: string;
}): Database {
  const tx = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([paymentRow]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  } as unknown as Database;
  return {
    ...tx,
    transaction: vi.fn(async (fn: (inner: Database) => Promise<unknown>) => fn(tx)),
  } as unknown as Database;
}

describe("StripePaymentWebhookService.handleDisputeClosed", () => {
  beforeEach(() => {
    vi.mocked(tryClaimProcessedStripeEvent).mockReset();
    vi.mocked(tryClaimProcessedStripeEvent).mockResolvedValue({ claimed: true });
  });

  it("creates an adjustment-only payout when a lost dispute has no open payout", async () => {
    vi.mocked(eq).mockClear();
    const createdPayout = {
      id: "po_adjustment",
      legalEntityId: "00000000-0000-4000-8000-000000000001",
    };
    const payoutRepository = {
      findOpenPayoutForEntity: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(createdPayout),
      insertLine: vi.fn().mockResolvedValue({ id: "line_1" }),
    } as unknown as IPayoutRepository;
    const publisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    } as unknown as DomainEventPublisher;
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "captured",
      amount: "5000.00",
    });
    const svc = new StripePaymentWebhookService(db, payoutRepository, publisher);
    const event = { id: "evt_dispute_closed", type: "charge.dispute.closed" } as Stripe.Event;
    const dispute = {
      id: "dp_1",
      status: "lost",
      amount: 500000,
      currency: "gbp",
      charge: "ch_1",
    } as Stripe.Dispute;

    const result = await svc.handleDisputeClosed(event, dispute);

    expect(result).toEqual({ processed: true, action: "dispute_closed" });
    expect(tryClaimProcessedStripeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ select: expect.any(Function) }),
      "evt_dispute_closed",
      "stripe_payment_webhook",
    );
    expect(vi.mocked(eq)).toHaveBeenCalledWith(payment.stripeChargeId, "ch_1");
    expect(payoutRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        legalEntityId: "00000000-0000-4000-8000-000000000001",
        grossAmount: "-5000.00",
        platformFee: "0.00",
        stripeFee: "0.00",
        netAmount: "-5000.00",
        currency: "GBP",
      }),
    );
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ select: expect.any(Function) }),
      expect.objectContaining({
        eventType: "payment.dispute_closed",
      }),
    );
  });

  it("short-circuits duplicate deliveries via processed_stripe_events", async () => {
    vi.mocked(tryClaimProcessedStripeEvent).mockResolvedValue({ claimed: false });
    const payoutRepository = {
      findOpenPayoutForEntity: vi.fn(),
      create: vi.fn(),
      insertLine: vi.fn(),
    } as unknown as IPayoutRepository;
    const publisher = { publish: vi.fn() } as unknown as DomainEventPublisher;
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "captured",
      amount: "5000.00",
    });
    const svc = new StripePaymentWebhookService(db, payoutRepository, publisher);
    const event = { id: "evt_dup", type: "charge.dispute.closed" } as Stripe.Event;
    const dispute = {
      id: "dp_dup",
      status: "won",
      amount: 100,
      currency: "gbp",
      charge: "ch_1",
    } as Stripe.Dispute;

    const result = await svc.handleDisputeClosed(event, dispute);

    expect(result).toEqual({
      processed: false,
      action: "skipped",
      reason: "duplicate_event",
    });
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it("uses the charge id from a dispute fixture even when a payment_intent is present", async () => {
    vi.mocked(eq).mockClear();
    const payoutRepository = {
      findOpenPayoutForEntity: vi.fn().mockResolvedValue({
        id: "po_open",
        legalEntityId: "00000000-0000-4000-8000-000000000001",
      }),
      insertLine: vi.fn().mockResolvedValue({ id: "line_1" }),
    } as unknown as IPayoutRepository;
    const publisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    } as unknown as DomainEventPublisher;
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "captured",
      amount: "5000.00",
    });
    const svc = new StripePaymentWebhookService(db, payoutRepository, publisher);
    const event = { id: "evt_dispute_fixture", type: "charge.dispute.created" } as Stripe.Event;
    const dispute = {
      id: "dp_fixture",
      status: "under_review",
      amount: 500000,
      currency: "gbp",
      charge: "ch_fixture",
      payment_intent: "pi_fixture",
    } as Stripe.Dispute;

    const result = await svc.handleDisputeCreated(event, dispute);

    expect(result).toEqual({ processed: true, action: "dispute_created" });
    expect(vi.mocked(eq)).toHaveBeenCalledWith(payment.stripeChargeId, "ch_fixture");
    expect(vi.mocked(eq)).not.toHaveBeenCalledWith(payment.stripePaymentIntentId, "ch_fixture");
  });

  it("uses the charge object id from a refund fixture instead of payment_intent", async () => {
    vi.mocked(eq).mockClear();
    const payoutRepository = {
      findOpenPayoutForEntity: vi.fn().mockResolvedValue({
        id: "po_open",
        legalEntityId: "00000000-0000-4000-8000-000000000001",
      }),
      insertLine: vi.fn().mockResolvedValue({ id: "line_1" }),
      sumRefundLineCentsForPayment: vi.fn().mockResolvedValue(0),
    } as unknown as IPayoutRepository;
    const publisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    } as unknown as DomainEventPublisher;
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "captured",
      amount: "5000.00",
    });
    const svc = new StripePaymentWebhookService(db, payoutRepository, publisher);
    const event = { id: "evt_refund_fixture", type: "charge.refunded" } as Stripe.Event;
    const charge = {
      id: "ch_refunded_fixture",
      amount: 500000,
      amount_refunded: 500000,
      currency: "gbp",
      payment_intent: "pi_refunded_fixture",
    } as Stripe.Charge;

    const result = await svc.handleChargeRefunded(event, charge);

    expect(result).toEqual({ processed: true, action: "refund_received" });
    expect(vi.mocked(eq)).toHaveBeenCalledWith(payment.stripeChargeId, "ch_refunded_fixture");
    expect(vi.mocked(eq)).not.toHaveBeenCalledWith(
      payment.stripePaymentIntentId,
      "ch_refunded_fixture",
    );
  });
});

describe("StripePaymentWebhookService.handleChargeRefunded — partial refunds", () => {
  beforeEach(() => {
    vi.mocked(tryClaimProcessedStripeEvent).mockReset();
    vi.mocked(tryClaimProcessedStripeEvent).mockResolvedValue({ claimed: true });
  });

  it("inserts a line for the delta when the second partial refund arrives", async () => {
    vi.mocked(eq).mockClear();
    const insertLine = vi.fn().mockResolvedValue({ id: "line_2" });
    const payoutRepository = {
      findOpenPayoutForEntity: vi.fn().mockResolvedValue({
        id: "po_open",
        legalEntityId: "00000000-0000-4000-8000-000000000001",
      }),
      insertLine,
      sumRefundLineCentsForPayment: vi.fn().mockResolvedValue(3000),
    } as unknown as IPayoutRepository;
    const publisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    } as unknown as DomainEventPublisher;
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "captured",
      amount: "100.00",
    });
    const svc = new StripePaymentWebhookService(db, payoutRepository, publisher);
    const event = { id: "evt_refund_partial_2", type: "charge.refunded" } as Stripe.Event;
    const charge = {
      id: "ch_partial",
      amount: 10000,
      amount_refunded: 5000,
      currency: "gbp",
    } as Stripe.Charge;

    const result = await svc.handleChargeRefunded(event, charge);

    expect(result).toEqual({ processed: true, action: "refund_received" });
    expect(insertLine).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: "-20.00",
        kind: "refund",
        sourceEventId: "evt_refund_partial_2",
      }),
    );
  });

  it("skips when cumulative amount_refunded already accounted for (replay or stale event)", async () => {
    vi.mocked(eq).mockClear();
    const insertLine = vi.fn().mockResolvedValue({ id: "line_dup" });
    const payoutRepository = {
      findOpenPayoutForEntity: vi.fn().mockResolvedValue({ id: "po_open" }),
      insertLine,
      sumRefundLineCentsForPayment: vi.fn().mockResolvedValue(5000),
    } as unknown as IPayoutRepository;
    const publisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    } as unknown as DomainEventPublisher;
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "captured",
      amount: "100.00",
    });
    const svc = new StripePaymentWebhookService(db, payoutRepository, publisher);
    const event = { id: "evt_refund_stale", type: "charge.refunded" } as Stripe.Event;
    const charge = {
      id: "ch_stale",
      amount: 10000,
      amount_refunded: 5000,
      currency: "gbp",
    } as Stripe.Charge;

    const result = await svc.handleChargeRefunded(event, charge);

    expect(result.action).toBe("skipped");
    expect(insertLine).not.toHaveBeenCalled();
  });
});
