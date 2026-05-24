import type { Database } from "@auction/db";
import { payment } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentCaptureNotAppliedError } from "../lib/errors.js";
import { tryClaimProcessedStripeEvent } from "../lib/stripe-processed-event.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { IPaymentCaptureService } from "./interfaces/payment-capture.js";
import type { IPaymentWriteRepository } from "./interfaces/payment-write.js";
import type { IPayoutAdjustmentService } from "./interfaces/payout-adjustment.js";
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
  const db = {
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
    transaction: vi.fn(),
  } as unknown as Database;
  vi.mocked(db.transaction).mockImplementation((async (fn) =>
    fn(db as never)) as typeof db.transaction);
  return db;
}

function createWebhookService(deps: {
  db: Database;
  payoutRepository?: Partial<IPayoutRepository>;
  publisher?: DomainEventPublisher;
  payoutAdjustments?: Partial<IPayoutAdjustmentService>;
  paymentCapture?: Partial<IPaymentCaptureService>;
  payments?: Partial<IPaymentWriteRepository>;
}) {
  const payoutAdjustments = {
    addPaymentLineToOpenPayoutOrCreateClawback: vi.fn().mockResolvedValue(undefined),
    ...deps.payoutAdjustments,
  } as IPayoutAdjustmentService;
  const paymentCapture = {
    capture: vi.fn().mockResolvedValue({ captured: true }),
    ...deps.paymentCapture,
  } as IPaymentCaptureService;
  const payoutRepository = {
    sumRefundLineCentsForPayment: vi.fn().mockResolvedValue(0),
    ...deps.payoutRepository,
  } as IPayoutRepository;
  const publisher =
    deps.publisher ?? ({ publish: vi.fn().mockResolvedValue(undefined) } as DomainEventPublisher);
  const payments = {
    applyRefundedInTransaction: vi.fn().mockResolvedValue(true),
    findById: vi.fn().mockResolvedValue({
      id: "pay_1",
      amount: "100.00",
      status: "pending",
    }),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    ...(deps.payments ?? {}),
  } as IPaymentWriteRepository;
  const svc = new StripePaymentWebhookService(
    deps.db,
    payments,
    payoutRepository,
    payoutAdjustments,
    paymentCapture,
    publisher,
  );
  return { svc, payoutAdjustments, paymentCapture, payoutRepository, publisher };
}

describe("StripePaymentWebhookService.handleDisputeClosed", () => {
  beforeEach(() => {
    vi.mocked(tryClaimProcessedStripeEvent).mockReset();
    vi.mocked(tryClaimProcessedStripeEvent).mockResolvedValue({ claimed: true });
  });

  it("creates a clawback adjustment when a lost dispute has no open payout", async () => {
    vi.mocked(eq).mockClear();
    const addLine = vi.fn().mockResolvedValue(undefined);
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "captured",
      amount: "5000.00",
    });
    const { svc, payoutAdjustments, publisher } = createWebhookService({
      db,
      payoutAdjustments: { addPaymentLineToOpenPayoutOrCreateClawback: addLine },
    });
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
    expect(payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback).toHaveBeenCalledWith(
      expect.objectContaining({
        legalEntityId: "00000000-0000-4000-8000-000000000001",
        paymentId: "pay_1",
        amount: "-5000.00",
        kind: "dispute",
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
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "captured",
      amount: "5000.00",
    });
    const { svc, publisher } = createWebhookService({ db });
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

  it("does not claw back when dispute closes with warning_closed", async () => {
    const addLine = vi.fn().mockResolvedValue(undefined);
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "captured",
      amount: "5000.00",
    });
    const { svc, payoutAdjustments } = createWebhookService({
      db,
      payoutAdjustments: { addPaymentLineToOpenPayoutOrCreateClawback: addLine },
    });
    const event = { id: "evt_dispute_warning", type: "charge.dispute.closed" } as Stripe.Event;
    const dispute = {
      id: "dp_warn",
      status: "warning_closed",
      amount: 500000,
      currency: "gbp",
      charge: "ch_1",
    } as Stripe.Dispute;

    const result = await svc.handleDisputeClosed(event, dispute);

    expect(result).toEqual({ processed: true, action: "dispute_closed" });
    expect(payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback).not.toHaveBeenCalled();
  });

  it("uses the charge id from a dispute fixture even when a payment_intent is present", async () => {
    vi.mocked(eq).mockClear();
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "captured",
      amount: "5000.00",
    });
    const { svc } = createWebhookService({ db });
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
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "captured",
      amount: "5000.00",
    });
    const { svc, payoutAdjustments } = createWebhookService({ db });
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
    expect(payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback).toHaveBeenCalled();
  });
});

describe("StripePaymentWebhookService.handleChargeRefunded — partial refunds", () => {
  beforeEach(() => {
    vi.mocked(tryClaimProcessedStripeEvent).mockReset();
    vi.mocked(tryClaimProcessedStripeEvent).mockResolvedValue({ claimed: true });
  });

  it("inserts a line for the delta when the second partial refund arrives", async () => {
    vi.mocked(eq).mockClear();
    const addLine = vi.fn().mockResolvedValue(undefined);
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "captured",
      amount: "100.00",
    });
    const { svc, payoutAdjustments } = createWebhookService({
      db,
      payoutRepository: { sumRefundLineCentsForPayment: vi.fn().mockResolvedValue(3000) },
      payoutAdjustments: { addPaymentLineToOpenPayoutOrCreateClawback: addLine },
    });
    const event = { id: "evt_refund_partial_2", type: "charge.refunded" } as Stripe.Event;
    const charge = {
      id: "ch_partial",
      amount: 10000,
      amount_refunded: 5000,
      currency: "gbp",
    } as Stripe.Charge;

    const result = await svc.handleChargeRefunded(event, charge);

    expect(result).toEqual({ processed: true, action: "refund_received" });
    expect(payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: "-20.00",
        kind: "refund",
        sourceEventId: "evt_refund_partial_2",
      }),
    );
  });

  it("creates clawback payout when refund has no open payout (C3 parity)", async () => {
    vi.mocked(eq).mockClear();
    const addLine = vi.fn().mockResolvedValue(undefined);
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "captured",
      amount: "100.00",
    });
    const { svc } = createWebhookService({
      db,
      payoutAdjustments: { addPaymentLineToOpenPayoutOrCreateClawback: addLine },
    });
    const event = { id: "evt_refund_clawback", type: "charge.refunded" } as Stripe.Event;
    const charge = {
      id: "ch_claw",
      amount: 10000,
      amount_refunded: 10000,
      currency: "gbp",
    } as Stripe.Charge;

    const result = await svc.handleChargeRefunded(event, charge);

    expect(result).toEqual({ processed: true, action: "refund_received" });
    expect(addLine).toHaveBeenCalledWith(
      expect.objectContaining({
        legalEntityId: "00000000-0000-4000-8000-000000000001",
        amount: "-100.00",
        kind: "refund",
      }),
    );
  });

  it("skips when cumulative amount_refunded already accounted for (replay or stale event)", async () => {
    vi.mocked(eq).mockClear();
    const addLine = vi.fn().mockResolvedValue(undefined);
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "captured",
      amount: "100.00",
    });
    const { svc, payoutAdjustments } = createWebhookService({
      db,
      payoutRepository: { sumRefundLineCentsForPayment: vi.fn().mockResolvedValue(5000) },
      payoutAdjustments: { addPaymentLineToOpenPayoutOrCreateClawback: addLine },
    });
    const event = { id: "evt_refund_stale", type: "charge.refunded" } as Stripe.Event;
    const charge = {
      id: "ch_stale",
      amount: 10000,
      amount_refunded: 5000,
      currency: "gbp",
    } as Stripe.Charge;

    const result = await svc.handleChargeRefunded(event, charge);

    expect(result.action).toBe("skipped");
    expect(payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback).not.toHaveBeenCalled();
  });
});

describe("StripePaymentWebhookService.handlePaymentIntentSucceeded", () => {
  beforeEach(() => {
    vi.mocked(tryClaimProcessedStripeEvent).mockReset();
    vi.mocked(tryClaimProcessedStripeEvent).mockResolvedValue({ claimed: true });
  });

  it("claims and captures inside one transaction", async () => {
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "pending",
      amount: "100.00",
    });
    const capture = vi.fn().mockResolvedValue(undefined);
    const { svc } = createWebhookService({
      db,
      paymentCapture: { capture },
    });
    const event = { id: "evt_pi_tx", type: "payment_intent.succeeded" } as Stripe.Event;
    const pi = {
      id: "pi_1",
      amount: 10000,
      metadata: { paymentId: "pay_1" },
      latest_charge: "ch_pi",
    } as unknown as Stripe.PaymentIntent;

    await svc.handlePaymentIntentSucceeded(event, pi);

    expect(db.transaction).toHaveBeenCalled();
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ tx: expect.any(Object), paymentId: "pay_1" }),
    );
  });

  it("captures payment via PaymentCaptureService", async () => {
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "pending",
      amount: "100.00",
    });
    const capture = vi.fn().mockResolvedValue({ captured: true });
    const { svc } = createWebhookService({
      db,
      paymentCapture: { capture },
    });
    const event = { id: "evt_pi", type: "payment_intent.succeeded" } as Stripe.Event;
    const pi = {
      id: "pi_1",
      amount: 10000,
      metadata: { paymentId: "pay_1" },
      latest_charge: "ch_pi",
    } as unknown as Stripe.PaymentIntent;

    const result = await svc.handlePaymentIntentSucceeded(event, pi);

    expect(result).toEqual({ processed: true, action: "payment_intent_succeeded" });
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: "pay_1",
        via: "stripe_checkout_webhook",
        stripeChargeId: "ch_pi",
        stripePaymentIntentId: "pi_1",
        requireApply: true,
      }),
    );
  });

  it("propagates capture failure so the event claim rolls back", async () => {
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "requires_manual_review",
      amount: "100.00",
    });
    const capture = vi
      .fn()
      .mockRejectedValue(new PaymentCaptureNotAppliedError("pay_1", "requires_manual_review"));
    const { svc } = createWebhookService({
      db,
      paymentCapture: { capture },
      payments: {
        findById: vi.fn().mockResolvedValue({
          id: "pay_1",
          amount: "100.00",
          status: "requires_manual_review",
        }),
      },
    });
    const event = { id: "evt_pi_fail", type: "payment_intent.succeeded" } as Stripe.Event;
    const pi = {
      id: "pi_1",
      amount: 10000,
      metadata: { paymentId: "pay_1" },
      latest_charge: "ch_pi",
    } as unknown as Stripe.PaymentIntent;

    await expect(svc.handlePaymentIntentSucceeded(event, pi)).rejects.toBeInstanceOf(
      PaymentCaptureNotAppliedError,
    );
  });

  it("does not claim the event when PaymentIntent amount does not match payment row", async () => {
    const capture = vi.fn().mockResolvedValue({ captured: true });
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "pending",
      amount: "100.00",
    });
    const { svc } = createWebhookService({
      db,
      paymentCapture: { capture },
      payments: {
        findById: vi.fn().mockResolvedValue({ id: "pay_1", amount: "100.00", status: "pending" }),
      },
    });
    const event = { id: "evt_pi_mismatch", type: "payment_intent.succeeded" } as Stripe.Event;
    const pi = {
      id: "pi_bad",
      amount: 9999,
      metadata: { paymentId: "pay_1" },
      latest_charge: "ch_pi",
    } as unknown as Stripe.PaymentIntent;

    const result = await svc.handlePaymentIntentSucceeded(event, pi);

    expect(result).toEqual({
      processed: false,
      action: "skipped",
      reason: "amount_mismatch",
    });
    expect(db.transaction).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
    expect(tryClaimProcessedStripeEvent).not.toHaveBeenCalled();
  });

  it("does not claim the event when payment row is missing", async () => {
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "pending",
      amount: "100.00",
    });
    const { svc } = createWebhookService({
      db,
      payments: { findById: vi.fn().mockResolvedValue(null) },
    });
    const event = { id: "evt_pi_missing", type: "payment_intent.succeeded" } as Stripe.Event;
    const pi = {
      id: "pi_missing",
      amount: 10000,
      metadata: { paymentId: "pay_missing" },
      latest_charge: "ch_pi",
    } as unknown as Stripe.PaymentIntent;

    const result = await svc.handlePaymentIntentSucceeded(event, pi);

    expect(result).toEqual({
      processed: false,
      action: "skipped",
      reason: "payment_not_found",
    });
    expect(db.transaction).not.toHaveBeenCalled();
    expect(tryClaimProcessedStripeEvent).not.toHaveBeenCalled();
  });

  it("records processing without capturing", async () => {
    vi.mocked(tryClaimProcessedStripeEvent).mockResolvedValue({ claimed: true });
    const capture = vi.fn();
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "pending",
      amount: "100.00",
    });
    const { svc } = createWebhookService({
      db,
      paymentCapture: { capture },
      payments: {
        findById: vi.fn().mockResolvedValue({
          id: "pay_1",
          lotId: "lot_1",
          buyerId: "buyer_1",
          amount: "100.00",
          status: "pending",
        }),
        updateStatus,
      },
    });
    const event = { id: "evt_processing", type: "payment_intent.processing" } as Stripe.Event;
    const pi = {
      id: "pi_proc",
      amount: 10000,
      metadata: { paymentId: "pay_1" },
    } as unknown as Stripe.PaymentIntent;

    const result = await svc.handlePaymentIntentProcessing(event, pi);

    expect(result).toEqual({ processed: true, action: "payment_intent_processing" });
    expect(capture).not.toHaveBeenCalled();
    expect(updateStatus).toHaveBeenCalledWith("pay_1", "authorized");
  });

  it("records partially funded bank transfer without capturing", async () => {
    vi.mocked(tryClaimProcessedStripeEvent).mockResolvedValue({ claimed: true });
    const capture = vi.fn();
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    const publish = vi.fn().mockResolvedValue(undefined);
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "pending",
      amount: "100.00",
    });
    const { svc, publisher } = createWebhookService({
      db,
      paymentCapture: { capture },
      publisher: { publish } as DomainEventPublisher,
      payments: {
        findById: vi.fn().mockResolvedValue({
          id: "pay_1",
          lotId: "lot_1",
          buyerId: "buyer_1",
          buyerLegalEntityId: "le_buyer",
          amount: "100.00",
          status: "pending",
        }),
        updateStatus,
      },
    });
    const event = {
      id: "evt_partial",
      type: "payment_intent.partially_funded",
    } as Stripe.Event;
    const pi = {
      id: "pi_partial",
      amount: 10000,
      amount_received: 5000,
      currency: "gbp",
      metadata: { paymentId: "pay_1" },
      next_action: {
        display_bank_transfer_instructions: { amount_remaining: 5000 },
      },
    } as unknown as Stripe.PaymentIntent;

    const result = await svc.handlePaymentIntentPartiallyFunded(event, pi);

    expect(result).toEqual({ processed: true, action: "payment_intent_partially_funded" });
    expect(capture).not.toHaveBeenCalled();
    expect(updateStatus).toHaveBeenCalledWith("pay_1", "authorized");
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "payment.bank_transfer_partially_funded" }),
    );
  });

  it("records failed payment intent without capturing", async () => {
    vi.mocked(tryClaimProcessedStripeEvent).mockResolvedValue({ claimed: true });
    const capture = vi.fn();
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "pending",
      amount: "100.00",
    });
    const { svc } = createWebhookService({ db, paymentCapture: { capture } });
    const event = { id: "evt_failed", type: "payment_intent.payment_failed" } as Stripe.Event;
    const pi = {
      id: "pi_fail",
      amount: 10000,
      metadata: { paymentId: "pay_1" },
    } as unknown as Stripe.PaymentIntent;

    const result = await svc.handlePaymentIntentFailed(event, pi);

    expect(result).toEqual({ processed: true, action: "payment_intent_failed" });
    expect(capture).not.toHaveBeenCalled();
  });

  it("records canceled payment intent without capturing", async () => {
    vi.mocked(tryClaimProcessedStripeEvent).mockResolvedValue({ claimed: true });
    const capture = vi.fn();
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "pending",
      amount: "100.00",
    });
    const { svc } = createWebhookService({ db, paymentCapture: { capture } });
    const event = { id: "evt_canceled", type: "payment_intent.canceled" } as Stripe.Event;
    const pi = {
      id: "pi_cancel",
      amount: 10000,
      metadata: { paymentId: "pay_1" },
    } as unknown as Stripe.PaymentIntent;

    const result = await svc.handlePaymentIntentCanceled(event, pi);

    expect(result).toEqual({ processed: true, action: "payment_intent_canceled" });
    expect(capture).not.toHaveBeenCalled();
  });
});
