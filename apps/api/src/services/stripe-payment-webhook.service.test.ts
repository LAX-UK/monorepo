import type { Database } from "@auction/db";
import { payment } from "@auction/db/schema";
import type { IPaymentEligibilityGate } from "@auction/finance-runtime";
import type { IPaymentWriteRepository } from "@auction/persistence/interfaces";
import type { IPayoutRepository } from "@auction/persistence/interfaces";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tryClaimProcessedStripeEvent } from "../lib/stripe-processed-event.js";
import { mockDomainEventSink } from "../test/domain-event-sink-mock.js";
import { InMemoryPaymentRefunds } from "../test/in-memory-payment-refunds.js";
import type { IDisputeWebhookRecorder } from "./disputes/dispute-case-recorder.js";
import type { IDomainEventSink } from "./domain-event-sink.js";
import type { IPaymentCaptureService } from "./interfaces/payment-capture.js";
import type { IPayoutAdjustmentService } from "./interfaces/payout-adjustment.js";
import type { IUnappliedMoneyRecorder } from "./payment/unapplied-money.recorder.js";
import { StripePaymentWebhookService } from "./stripe-payment-webhook.service.js";

vi.mock("./payout/payout-helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./payout/payout-helpers.js")>();
  return {
    ...actual,
    payoutRepoForTx: (rootRepo: IPayoutRepository) => rootRepo,
  };
});

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
  db?: Database;
  transactionRunner?: {
    runInTransaction: (fn: (tx: Database) => Promise<unknown>) => Promise<unknown>;
  };
  paymentWebhookLookup?: {
    findPaymentRow: (where: unknown) => Promise<{
      id: string;
      sellerLegalEntityId: string;
      status: string;
      amount: string;
    } | null>;
  };
  payoutRepository?: Partial<IPayoutRepository>;
  publisher?: IDomainEventSink;
  payoutAdjustments?: Partial<IPayoutAdjustmentService>;
  paymentCapture?: Partial<IPaymentCaptureService>;
  payments?: Partial<IPaymentWriteRepository>;
  disputes?: IDisputeWebhookRecorder;
  unappliedMoney?: IUnappliedMoneyRecorder;
  paymentEligibility?: IPaymentEligibilityGate;
  paymentRefunds?: InMemoryPaymentRefunds;
  /** Pence of refund lines the seller's ledger already holds for the payment. */
  sellerRefundedCents?: number;
}) {
  // The seller's ledger, which every clawback line lands in, as it does in the payout lines table.
  let sellerCents = deps.sellerRefundedCents ?? 0;
  const payoutAdjustments = {
    addPaymentLineToOpenPayoutOrCreateClawback: vi.fn(async (line: { amount: string }) => {
      sellerCents += Math.round(Math.abs(Number(line.amount)) * 100);
      await deps.payoutAdjustments?.addPaymentLineToOpenPayoutOrCreateClawback?.(line as never);
    }),
  } as unknown as IPayoutAdjustmentService;
  const paymentCapture = {
    capture: vi.fn().mockResolvedValue({ captured: true }),
    ...deps.paymentCapture,
  } as IPaymentCaptureService;
  const payoutRepository = {
    sumRefundLineCentsForPayment: vi.fn(async () => sellerCents),
    ...deps.payoutRepository,
  } as IPayoutRepository;
  const paymentRefunds = deps.paymentRefunds ?? new InMemoryPaymentRefunds();
  const publisher = deps.publisher ?? mockDomainEventSink();
  const unappliedMoney = deps.unappliedMoney ?? {
    record: vi.fn().mockResolvedValue(undefined),
    resolveRefundedCharge: vi.fn().mockResolvedValue(undefined),
    resolveApplied: vi.fn().mockResolvedValue(undefined),
  };
  const payments = {
    applyRefundedInTransaction: vi.fn().mockResolvedValue(true),
    applyAuthorizedInTransaction: vi.fn().mockResolvedValue(true),
    applyCancelledInTransaction: vi.fn().mockResolvedValue(true),
    findById: vi.fn().mockResolvedValue({
      id: "pay_1",
      amount: "100.00",
      status: "pending",
    }),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    ...(deps.payments ?? {}),
  } as IPaymentWriteRepository;
  const db = deps.db ?? ({} as Database);
  const transactionRunner = deps.transactionRunner ?? {
    runInTransaction: async (fn: (tx: Database) => Promise<unknown>) => fn(db),
  };
  const paymentWebhookLookup = deps.paymentWebhookLookup ?? {
    findPaymentRow: vi.fn(async () => {
      const [row] = await db
        .select({
          id: payment.id,
          sellerLegalEntityId: payment.sellerLegalEntityId,
          status: payment.status,
          amount: payment.amount,
        })
        .from(payment)
        .where(eq(payment.id, "pay_1"))
        .limit(1);
      if (!row?.sellerLegalEntityId) return null;
      return {
        id: row.id,
        sellerLegalEntityId: row.sellerLegalEntityId,
        status: row.status,
        amount: String(row.amount),
      };
    }),
  };
  const svc = new StripePaymentWebhookService(
    transactionRunner as never,
    paymentWebhookLookup as never,
    payments,
    payoutRepository,
    payoutAdjustments,
    paymentCapture,
    publisher,
    deps.disputes ?? { record: vi.fn() },
    null,
    null,
    unappliedMoney,
    null,
    deps.paymentEligibility ?? null,
    paymentRefunds,
  );
  return {
    svc,
    payoutAdjustments,
    paymentCapture,
    payoutRepository,
    publisher,
    unappliedMoney,
    paymentRefunds,
  };
}

/** A refund already on record for a payment, as an earlier event or staff would have left it. */
async function recorded(
  paymentId: string,
  amountPence: number,
  source: "card_webhook" | "staff" = "card_webhook",
) {
  const refunds = new InMemoryPaymentRefunds();
  await refunds.recordInTransaction(
    {},
    {
      paymentId,
      idempotencyKey: `earlier:${paymentId}:${amountPence}`,
      amountPence,
      currency: "GBP",
      source,
    },
  );
  return refunds;
}

describe("StripePaymentWebhookService dispute webhooks", () => {
  it("hands every dispute webhook to the dispute case recorder with its stage", async () => {
    const record = vi.fn().mockResolvedValue({ processed: true, action: "dispute_created" });
    const { svc } = createWebhookService({ disputes: { record } });
    const dispute = {
      id: "dp_fixture",
      status: "under_review",
      amount: 500000,
      currency: "gbp",
      charge: "ch_fixture",
      payment_intent: "pi_fixture",
    } as Stripe.Dispute;
    const event = { id: "evt_dispute_fixture" } as Stripe.Event;

    await svc.handleDisputeCreated(event, dispute);
    await svc.handleDisputeUpdated(event, dispute);
    await svc.handleDisputeFundsWithdrawn(event, dispute);
    await svc.handleDisputeFundsReinstated(event, dispute);
    await svc.handleDisputeClosed(event, dispute);

    expect(record.mock.calls.map(([stage]) => stage)).toEqual([
      "created",
      "updated",
      "funds_withdrawn",
      "funds_reinstated",
      "closed",
    ]);
    expect(record).toHaveBeenCalledWith("created", event, dispute);
  });
});

describe("StripePaymentWebhookService.handleChargeRefunded — charge fixtures", () => {
  beforeEach(() => {
    vi.mocked(tryClaimProcessedStripeEvent).mockReset();
    vi.mocked(tryClaimProcessedStripeEvent).mockResolvedValue({ claimed: true });
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
    const paymentRefunds = await recorded("pay_1", 3000);
    const { svc, payoutAdjustments } = createWebhookService({
      db,
      paymentRefunds,
      sellerRefundedCents: 3000,
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
    const paymentRefunds = await recorded("pay_1", 5000);
    const { svc, payoutAdjustments } = createWebhookService({
      db,
      paymentRefunds,
      sellerRefundedCents: 5000,
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

describe("StripePaymentWebhookService.handleChargeRefunded — the buyer's refund record", () => {
  beforeEach(() => {
    vi.mocked(tryClaimProcessedStripeEvent).mockReset();
    vi.mocked(tryClaimProcessedStripeEvent).mockResolvedValue({ claimed: true });
  });

  const row = {
    id: "pay_1",
    sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
    status: "captured",
    amount: "100.00",
  };
  const charge = (amountRefunded: number) =>
    ({
      id: "ch_rec",
      amount: 10000,
      amount_refunded: amountRefunded,
      currency: "gbp",
    }) as Stripe.Charge;
  const event = (id: string) => ({ id, type: "charge.refunded" }) as Stripe.Event;

  it("records the refund by event id, in the currency of the charge", async () => {
    const { svc, paymentRefunds } = createWebhookService({ db: mockDbWithPayment(row) });
    await svc.handleChargeRefunded(event("evt_1"), charge(4000));
    expect(paymentRefunds.entries).toEqual([
      {
        paymentId: "pay_1",
        idempotencyKey: "evt_1",
        amountPence: 4000,
        currency: "GBP",
        source: "card_webhook",
      },
    ]);
  });

  it("records only the part of each later refund that is new", async () => {
    const { svc, paymentRefunds } = createWebhookService({ db: mockDbWithPayment(row) });
    await svc.handleChargeRefunded(event("evt_1"), charge(4000));
    await svc.handleChargeRefunded(event("evt_2"), charge(7500));
    expect(paymentRefunds.entries.map((e) => e.amountPence)).toEqual([4000, 3500]);
    expect((await paymentRefunds.sumRefundedPence("pay_1")).pence).toBe(7500);
  });

  it("records nothing again when another event reports the same total", async () => {
    const { svc, paymentRefunds } = createWebhookService({ db: mockDbWithPayment(row) });
    await svc.handleChargeRefunded(event("evt_1"), charge(4000));
    const replay = await svc.handleChargeRefunded(event("evt_replayed"), charge(4000));
    expect(replay).toMatchObject({ action: "skipped", reason: "no_new_refund_amount" });
    expect(paymentRefunds.entries).toHaveLength(1);
  });

  it("handles refund events that arrive out of order without recording or charging back twice", async () => {
    const addLine = vi.fn();
    const { svc, paymentRefunds } = createWebhookService({
      db: mockDbWithPayment(row),
      payoutAdjustments: { addPaymentLineToOpenPayoutOrCreateClawback: addLine },
    });
    // The later refund (total 75.00) is delivered before the earlier one (total 40.00).
    const later = await svc.handleChargeRefunded(event("evt_2"), charge(7500));
    const earlier = await svc.handleChargeRefunded(event("evt_1"), charge(4000));
    expect(later).toEqual({ processed: true, action: "refund_received" });
    expect(earlier).toMatchObject({ action: "skipped", reason: "no_new_refund_amount" });
    expect(paymentRefunds.entries.map((e) => [e.idempotencyKey, e.amountPence])).toEqual([
      ["evt_2", 7500],
    ]);
    expect(addLine).toHaveBeenCalledTimes(1);
    expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ amount: "-75.00" }));
    // A final event for the whole charge adds only what is still missing.
    await svc.handleChargeRefunded(event("evt_3"), charge(10000));
    expect(paymentRefunds.entries.map((e) => e.amountPence)).toEqual([7500, 2500]);
    expect(addLine).toHaveBeenLastCalledWith(expect.objectContaining({ amount: "-25.00" }));
  });

  it("locks the payment before it sums what is recorded, and records after", async () => {
    const { svc, paymentRefunds } = createWebhookService({ db: mockDbWithPayment(row) });
    await svc.handleChargeRefunded(event("evt_1"), charge(4000));
    expect(paymentRefunds.calls).toEqual(["lock:pay_1", "sum:pay_1", "record:pay_1"]);
  });

  it("records a refund the previous release handled without charging the seller back again", async () => {
    // The previous release wrote the seller's refund line (100.00) and no buyer row.
    const addLine = vi.fn();
    const publish = vi.fn();
    const { svc, paymentRefunds } = createWebhookService({
      db: mockDbWithPayment(row),
      sellerRefundedCents: 10000,
      publisher: mockDomainEventSink(publish),
      payoutAdjustments: { addPaymentLineToOpenPayoutOrCreateClawback: addLine },
    });
    const result = await svc.handleChargeRefunded(event("evt_gap"), charge(10000));
    expect(result).toMatchObject({ action: "skipped", reason: "refund_already_in_seller_ledger" });
    expect(paymentRefunds.entries).toMatchObject([
      { idempotencyKey: "evt_gap", amountPence: 10000 },
    ]);
    expect(addLine).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("charges the seller back only for what is new after a refund in the rollout gap", async () => {
    const addLine = vi.fn();
    const { svc, paymentRefunds } = createWebhookService({
      db: mockDbWithPayment(row),
      sellerRefundedCents: 4000,
      payoutAdjustments: { addPaymentLineToOpenPayoutOrCreateClawback: addLine },
    });
    await svc.handleChargeRefunded(event("evt_next"), charge(7500));
    // The buyer's record is behind by the whole 75.00; the seller's ledger only by 35.00.
    expect(paymentRefunds.entries.map((e) => e.amountPence)).toEqual([7500]);
    expect(addLine).toHaveBeenCalledTimes(1);
    expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ amount: "-35.00" }));
  });

  it("does not count again a refund staff already recorded for the same money", async () => {
    const paymentRefunds = await recorded("pay_1", 10000, "staff");
    const addLine = vi.fn();
    const { svc } = createWebhookService({
      db: mockDbWithPayment(row),
      paymentRefunds,
      sellerRefundedCents: 10000,
      payoutAdjustments: { addPaymentLineToOpenPayoutOrCreateClawback: addLine },
    });
    const result = await svc.handleChargeRefunded(event("evt_after_staff"), charge(10000));
    expect(result).toMatchObject({ action: "skipped", reason: "no_new_refund_amount" });
    expect(paymentRefunds.entries).toHaveLength(1);
    expect(addLine).not.toHaveBeenCalled();
  });

  it("records the refund with the payout line and the event, in one transaction", async () => {
    const order: string[] = [];
    const paymentRefunds = new InMemoryPaymentRefunds();
    const record = paymentRefunds.recordInTransaction.bind(paymentRefunds);
    paymentRefunds.recordInTransaction = async (tx, entry) => {
      order.push("record");
      return record(tx, entry);
    };
    const publish = vi.fn(async () => {
      order.push("publish");
    });
    const { svc } = createWebhookService({
      db: mockDbWithPayment(row),
      paymentRefunds,
      publisher: mockDomainEventSink(publish),
      payoutAdjustments: {
        addPaymentLineToOpenPayoutOrCreateClawback: vi.fn(async () => {
          order.push("payout_line");
        }),
      },
    });
    await svc.handleChargeRefunded(event("evt_1"), charge(10000));
    expect(order).toEqual(["record", "payout_line", "publish"]);
  });

  it("fails, to be retried, when the refund record is not wired", async () => {
    const unwired = new StripePaymentWebhookService(
      {
        runInTransaction: async (fn: (tx: never) => Promise<unknown>) => fn({} as never),
      } as never,
      {
        findPaymentRow: async () => ({ ...row, sellerLegalEntityId: row.sellerLegalEntityId }),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      mockDomainEventSink(),
      { record: vi.fn() },
    );
    await expect(unwired.handleChargeRefunded(event("evt_1"), charge(4000))).rejects.toThrow(
      "Payment refunds are not wired",
    );
  });
});

describe("StripePaymentWebhookService.handlePaymentIntentSucceeded", () => {
  beforeEach(() => {
    vi.mocked(tryClaimProcessedStripeEvent).mockReset();
    vi.mocked(tryClaimProcessedStripeEvent).mockResolvedValue({ claimed: true });
  });

  it.each([
    [{ kind: "held", reason: "identity_verification_required" }, "identity_verification_required"],
    [{ kind: "held", reason: "organisation_under_review" }, "organisation_under_review"],
    [{ kind: "refused", reason: "organisation_closed" }, "finance_release_required"],
  ] as const)(
    "money for an account that cannot pay (%o) goes to manual review, never captured",
    async (eligibility, reason) => {
      const capture = vi.fn();
      const applyHeldMoneyInTransaction = vi.fn().mockResolvedValue(true);
      const publish = vi.fn().mockResolvedValue(undefined);
      const check = vi.fn().mockResolvedValue(eligibility);
      const { svc } = createWebhookService({
        paymentCapture: { capture },
        publisher: mockDomainEventSink(publish),
        paymentEligibility: { check },
        payments: {
          applyHeldMoneyInTransaction,
          findById: vi.fn().mockResolvedValue({
            id: "pay_1",
            lotId: "lot_1",
            amount: "100.00",
            status: "pending",
            buyerId: "user_1",
            buyerLegalEntityId: "le_1",
            sellerLegalEntityId: "le_s",
          }),
        },
      });
      const pi = {
        id: "pi_1",
        amount: 10000,
        metadata: { paymentId: "pay_1" },
        latest_charge: "ch_pi",
      } as unknown as Stripe.PaymentIntent;

      const result = await svc.handlePaymentIntentSucceeded(
        { id: "evt_pi", type: "payment_intent.succeeded" } as Stripe.Event,
        pi,
      );

      expect(check).toHaveBeenCalledWith({ payerUserId: "user_1", buyerLegalEntityId: "le_1" });
      expect(capture).not.toHaveBeenCalled();
      expect(applyHeldMoneyInTransaction).toHaveBeenCalledWith(expect.anything(), "pay_1", {
        stripePaymentIntentId: "pi_1",
        stripeChargeId: "ch_pi",
      });
      expect(publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "payment.requires_manual_review",
          payload: expect.objectContaining({ paymentId: "pay_1", reason }),
        }),
      );
      expect(result).toEqual({ processed: true, action: "payment_intent_succeeded_held", reason });
    },
  );

  it("money for an account that can pay is captured as usual", async () => {
    const capture = vi.fn().mockResolvedValue({ captured: true });
    const { svc } = createWebhookService({
      paymentCapture: { capture },
      paymentEligibility: { check: vi.fn().mockResolvedValue({ kind: "payable" }) },
      payments: {
        findById: vi.fn().mockResolvedValue({
          id: "pay_1",
          amount: "100.00",
          status: "pending",
          buyerId: "user_1",
          buyerLegalEntityId: "le_1",
        }),
      },
    });
    const pi = {
      id: "pi_1",
      amount: 10000,
      metadata: { paymentId: "pay_1" },
      latest_charge: "ch_pi",
    } as unknown as Stripe.PaymentIntent;
    await svc.handlePaymentIntentSucceeded({ id: "evt_pi" } as Stripe.Event, pi);
    expect(capture).toHaveBeenCalled();
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

  it("captures payment that was held for manual review when Stripe succeeded", async () => {
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "requires_manual_review",
      amount: "100.00",
    });
    const capture = vi.fn().mockResolvedValue({ captured: true });
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
    const event = { id: "evt_pi_manual", type: "payment_intent.succeeded" } as Stripe.Event;
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
        requireApply: true,
      }),
    );
  });

  it("blocks capture and emits reconciliation event when payment is cancelled", async () => {
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "cancelled",
      amount: "100.00",
    });
    const capture = vi.fn().mockResolvedValue({ captured: true });
    const publish = vi.fn().mockResolvedValue(undefined);
    const { svc } = createWebhookService({
      db,
      paymentCapture: { capture },
      publisher: mockDomainEventSink(publish),
      payments: {
        findById: vi.fn().mockResolvedValue({
          id: "pay_1",
          lotId: "lot-1",
          amount: "100.00",
          status: "cancelled",
          paidByUserId: "buyer-1",
          buyerLegalEntityId: "00000000-0000-4000-8000-000000000002",
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

    const result = await svc.handlePaymentIntentSucceeded(event, pi);

    expect(result).toEqual({
      processed: true,
      action: "payment_intent_succeeded_terminal_blocked",
      reason: "payment_terminal_status",
    });
    expect(capture).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "payment.capture_blocked_terminal_status",
        aggregateId: "pay_1",
      }),
    );
  });

  it("records money of the wrong amount as unapplied, for finance, and never captures it", async () => {
    const capture = vi.fn().mockResolvedValue({ captured: true });
    const { svc, unappliedMoney } = createWebhookService({
      paymentCapture: { capture },
      payments: {
        findById: vi.fn().mockResolvedValue({ id: "pay_1", amount: "100.00", status: "pending" }),
      },
    });
    const event = { id: "evt_pi_mismatch", type: "payment_intent.succeeded" } as Stripe.Event;
    const pi = {
      id: "pi_bad",
      amount: 9999,
      amount_received: 9999,
      currency: "gbp",
      metadata: { paymentId: "pay_1" },
      latest_charge: "ch_pi",
    } as unknown as Stripe.PaymentIntent;

    const result = await svc.handlePaymentIntentSucceeded(event, pi);

    expect(result).toEqual({
      processed: true,
      action: "unapplied_money_recorded",
      reason: "amount_mismatch",
    });
    expect(capture).not.toHaveBeenCalled();
    expect(unappliedMoney.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        reason: "amount_mismatch",
        paymentId: "pay_1",
        stripePaymentIntentId: "pi_bad",
        stripeChargeId: "ch_pi",
        amountCents: 9999,
      }),
      null,
    );
  });

  it("money for an invoice already paid by other money is a finance task, not a capture", async () => {
    const capture = vi.fn();
    const { svc, unappliedMoney } = createWebhookService({
      paymentCapture: { capture },
      payments: {
        findById: vi.fn().mockResolvedValue({
          id: "pay_1",
          amount: "100.00",
          status: "captured",
          stripeChargeId: "ch_first",
          stripePaymentIntentId: null,
        }),
      },
    });
    const pi = {
      id: "pi_second",
      amount: 10000,
      amount_received: 10000,
      currency: "gbp",
      metadata: { paymentId: "pay_1" },
      latest_charge: "ch_second",
    } as unknown as Stripe.PaymentIntent;

    const result = await svc.handlePaymentIntentSucceeded(
      { id: "evt_second", type: "payment_intent.succeeded" } as Stripe.Event,
      pi,
    );

    expect(result).toMatchObject({ processed: true, reason: "invoice_already_paid" });
    expect(capture).not.toHaveBeenCalled();
    expect(unappliedMoney.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reason: "invoice_already_paid", stripeChargeId: "ch_second" }),
      null,
    );
  });

  it("the same money as the recorded payment is a replay: nothing is reported", async () => {
    const capture = vi.fn().mockResolvedValue({ captured: false });
    const { svc, unappliedMoney } = createWebhookService({
      paymentCapture: { capture },
      payments: {
        findById: vi.fn().mockResolvedValue({
          id: "pay_1",
          amount: "100.00",
          status: "captured",
          stripeChargeId: "ch_first",
        }),
      },
    });
    const pi = {
      id: "pi_first",
      amount: 10000,
      metadata: { paymentId: "pay_1" },
      latest_charge: "ch_first",
    } as unknown as Stripe.PaymentIntent;

    await svc.handlePaymentIntentSucceeded(
      { id: "evt_first_again", type: "payment_intent.succeeded" } as Stripe.Event,
      pi,
    );

    expect(unappliedMoney.record).not.toHaveBeenCalled();
  });

  it("money for a refunded invoice is reported as unapplied as well as blocked", async () => {
    const { svc, unappliedMoney } = createWebhookService({
      payments: {
        findById: vi.fn().mockResolvedValue({ id: "pay_1", amount: "100.00", status: "refunded" }),
      },
    });
    const pi = {
      id: "pi_late",
      amount: 10000,
      currency: "gbp",
      metadata: { paymentId: "pay_1" },
      latest_charge: "ch_late",
    } as unknown as Stripe.PaymentIntent;

    const result = await svc.handlePaymentIntentSucceeded(
      { id: "evt_late", type: "payment_intent.succeeded" } as Stripe.Event,
      pi,
    );

    expect(result.action).toBe("payment_intent_succeeded_terminal_blocked");
    expect(unappliedMoney.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reason: "invoice_refunded" }),
      null,
    );
  });

  it("a bank transfer left in the buyer's Stripe balance becomes a finance task", async () => {
    const { svc, unappliedMoney } = createWebhookService({});
    const result = await svc.handleCashBalanceFundsAvailable(
      { id: "evt_cash", type: "cash_balance.funds_available" } as Stripe.Event,
      { customer: "cus_1", available: { gbp: 250000 } } as unknown as Stripe.CashBalance,
    );
    expect(result).toEqual({ processed: true, action: "customer_balance_unapplied" });
    expect(unappliedMoney.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        reason: "customer_balance_unapplied",
        stripeCustomerId: "cus_1",
        stripeEventId: "evt_cash:gbp",
        amountCents: 250000,
        currency: "gbp",
      }),
      null,
    );
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
    const applyAuthorized = vi.fn().mockResolvedValue(true);
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
        applyAuthorizedInTransaction: applyAuthorized,
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
    expect(applyAuthorized).toHaveBeenCalledWith(expect.anything(), "pay_1");
  });

  it("records partially funded bank transfer without capturing", async () => {
    vi.mocked(tryClaimProcessedStripeEvent).mockResolvedValue({ claimed: true });
    const capture = vi.fn();
    const applyAuthorized = vi.fn().mockResolvedValue(true);
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
      publisher: mockDomainEventSink(publish),
      payments: {
        findById: vi.fn().mockResolvedValue({
          id: "pay_1",
          lotId: "lot_1",
          buyerId: "buyer_1",
          buyerLegalEntityId: "le_buyer",
          amount: "100.00",
          status: "pending",
        }),
        applyAuthorizedInTransaction: applyAuthorized,
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
    expect(applyAuthorized).toHaveBeenCalledWith(expect.anything(), "pay_1");
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "payment.bank_transfer_partially_funded" }),
    );
  });

  it("records failed payment intent without capturing or cancelling", async () => {
    vi.mocked(tryClaimProcessedStripeEvent).mockResolvedValue({ claimed: true });
    const capture = vi.fn();
    const updateStatus = vi.fn();
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
      publisher: mockDomainEventSink(publish),
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
    const event = { id: "evt_failed", type: "payment_intent.payment_failed" } as Stripe.Event;
    const pi = {
      id: "pi_fail",
      amount: 10000,
      metadata: { paymentId: "pay_1" },
    } as unknown as Stripe.PaymentIntent;

    const result = await svc.handlePaymentIntentFailed(event, pi);

    expect(result).toEqual({ processed: true, action: "payment_intent_failed" });
    expect(capture).not.toHaveBeenCalled();
    expect(updateStatus).not.toHaveBeenCalled();
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "payment.checkout_failed",
        payload: expect.objectContaining({
          paymentId: "pay_1",
          lotId: "lot_1",
          stripePaymentIntentId: "pi_fail",
          statusBefore: "pending",
        }),
      }),
    );
  });

  it("cancels pending payment when Stripe payment intent is canceled", async () => {
    vi.mocked(tryClaimProcessedStripeEvent).mockResolvedValue({ claimed: true });
    const capture = vi.fn();
    const applyCancelled = vi.fn().mockResolvedValue(true);
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
      publisher: mockDomainEventSink(publish),
      payments: {
        findById: vi.fn().mockResolvedValue({
          id: "pay_1",
          lotId: "lot_1",
          buyerId: "buyer_1",
          buyerLegalEntityId: "le_buyer",
          amount: "100.00",
          status: "pending",
        }),
        applyCancelledInTransaction: applyCancelled,
      },
    });
    const event = { id: "evt_canceled", type: "payment_intent.canceled" } as Stripe.Event;
    const pi = {
      id: "pi_cancel",
      amount: 10000,
      metadata: { paymentId: "pay_1" },
    } as unknown as Stripe.PaymentIntent;

    const result = await svc.handlePaymentIntentCanceled(event, pi);

    expect(result).toEqual({ processed: true, action: "payment_intent_canceled" });
    expect(capture).not.toHaveBeenCalled();
    expect(applyCancelled).toHaveBeenCalledWith(expect.anything(), "pay_1");
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "payment.cancelled",
        payload: expect.objectContaining({
          lotId: "lot_1",
          reason: "stripe_payment_intent_canceled",
        }),
      }),
    );
  });

  it("cancels authorized payment on checkout.session.async_payment_failed", async () => {
    vi.mocked(tryClaimProcessedStripeEvent).mockResolvedValue({ claimed: true });
    const applyCancelled = vi.fn().mockResolvedValue(true);
    const publish = vi.fn().mockResolvedValue(undefined);
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "authorized",
      amount: "100.00",
    });
    const { svc, publisher } = createWebhookService({
      db,
      publisher: mockDomainEventSink(publish),
      payments: {
        findById: vi.fn().mockResolvedValue({
          id: "pay_1",
          lotId: "lot_1",
          buyerId: "buyer_1",
          buyerLegalEntityId: "le_buyer",
          amount: "100.00",
          status: "authorized",
        }),
        applyCancelledInTransaction: applyCancelled,
      },
    });
    const event = {
      id: "evt_async_fail",
      type: "checkout.session.async_payment_failed",
    } as Stripe.Event;
    const session = {
      metadata: { paymentId: "pay_1" },
    } as unknown as Stripe.Checkout.Session;

    const result = await svc.handleCheckoutSessionAsyncPaymentFailed(event, session);

    expect(result).toEqual({
      processed: true,
      action: "checkout_session_async_payment_failed",
    });
    expect(applyCancelled).toHaveBeenCalledWith(expect.anything(), "pay_1");
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "payment.cancelled",
        payload: expect.objectContaining({ reason: "stripe_checkout_async_payment_failed" }),
      }),
    );
  });

  it("skips duplicate canceled payment intent deliveries", async () => {
    vi.mocked(tryClaimProcessedStripeEvent).mockResolvedValue({ claimed: false });
    const updateStatus = vi.fn();
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "pending",
      amount: "100.00",
    });
    const { svc } = createWebhookService({
      db,
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
    const event = { id: "evt_canceled_dup", type: "payment_intent.canceled" } as Stripe.Event;
    const pi = {
      id: "pi_cancel",
      amount: 10000,
      metadata: { paymentId: "pay_1" },
    } as unknown as Stripe.PaymentIntent;

    const result = await svc.handlePaymentIntentCanceled(event, pi);

    expect(result).toEqual({
      processed: false,
      action: "skipped",
      reason: "duplicate_event",
    });
    expect(updateStatus).not.toHaveBeenCalled();
  });
});
