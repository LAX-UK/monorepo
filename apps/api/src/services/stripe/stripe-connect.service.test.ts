import type { Database } from "@auction/db";
import type { Payout } from "@auction/types";
import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import type { Env } from "../../env.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { IPayoutRepository } from "../interfaces/payout-repository.js";
import type { IPayoutService } from "../interfaces/payout.js";
import { StripeConnectService } from "./stripe-connect.service.js";

function baseEnv(overrides: Partial<Env> = {}): Env {
  return {
    STRIPE_SECRET_KEY: "sk_test_dummy",
    STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_dummy",
    ...overrides,
  } as Env;
}

function payout(overrides: Partial<Payout> = {}): Payout {
  return {
    id: "po1",
    legalEntityId: "le1",
    periodStart: new Date("2026-01-01"),
    periodEnd: new Date("2026-01-31"),
    grossAmount: "1000.00",
    platformFee: "50.00",
    stripeFee: "0.00",
    netAmount: "950.00",
    currency: "GBP",
    status: "in_transit",
    stripeTransferId: "tr_1",
    xeroBillId: null,
    failureReason: null,
    processedAt: null,
    statementUrl: null,
    statementGenerationError: null,
    createdAt: new Date("2026-02-01"),
    ...overrides,
  };
}

function makePayoutService(result: Payout | null): IPayoutService {
  return {
    listForLegalEntity: vi.fn(),
    getById: vi.fn(),
    previewPending: vi.fn(),
    adminList: vi.fn(),
    createSettlement: vi.fn(),
    addAdjustment: vi.fn(),
    markPaid: vi.fn(),
    reconcileStripeTransfer: vi.fn().mockResolvedValue(result),
  } as unknown as IPayoutService;
}

function injectWebhookEvent(service: StripeConnectService, event: Stripe.Event): void {
  (
    service as unknown as {
      stripe: {
        webhooks: { constructEvent: ReturnType<typeof vi.fn> };
        accounts: { retrieve: ReturnType<typeof vi.fn> };
      };
    }
  ).stripe = {
    webhooks: { constructEvent: vi.fn().mockReturnValue(event) },
    accounts: { retrieve: vi.fn() },
  };
}

describe("StripeConnectService.handleWebhook transfer events", () => {
  it("reconciles transfer.created with payout metadata and expanded fee", async () => {
    const payoutService = makePayoutService(payout());
    const svc = new StripeConnectService(baseEnv(), {} as Database, payoutService);
    const transfer = {
      id: "tr_1",
      created: 1_778_000_000,
      metadata: { payoutId: "po1" },
      balance_transaction: { fee: 210 },
    } as unknown as Stripe.Transfer;
    injectWebhookEvent(svc, {
      type: "transfer.created",
      data: { object: transfer },
    } as Stripe.Event);

    const result = await svc.handleWebhook("{}", "sig");

    expect(result.processed).toBe(true);
    expect(payoutService.reconcileStripeTransfer).toHaveBeenCalledWith({
      stripeTransferId: "tr_1",
      payoutId: "po1",
      status: "created",
      stripeFee: "2.10",
      failureReason: null,
      occurredAt: new Date(1_778_000_000 * 1000),
    });
  });

  it("returns processed false when no local payout matches the transfer", async () => {
    const payoutService = makePayoutService(null);
    const svc = new StripeConnectService(baseEnv(), {} as Database, payoutService);
    injectWebhookEvent(svc, {
      type: "transfer.updated",
      data: {
        object: {
          id: "tr_missing",
          created: 1_778_000_000,
          metadata: {},
          balance_transaction: null,
        } as Stripe.Transfer,
      },
    } as Stripe.Event);

    const result = await svc.handleWebhook("{}", "sig");

    expect(result.processed).toBe(false);
    expect(payoutService.reconcileStripeTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeTransferId: "tr_missing",
        status: "created",
      }),
    );
  });

  it("reconciles transfer.reversed with stripeEventId and reversedAmountCents", async () => {
    const payoutService = makePayoutService(payout({ status: "reversed" }));
    const svc = new StripeConnectService(baseEnv(), {} as Database, payoutService);
    const transfer = {
      id: "tr_reversed",
      created: 1_778_000_000,
      metadata: { payoutId: "po1" },
      balance_transaction: null,
      amount: 95000,
      amount_reversed: 95000,
    } as unknown as Stripe.Transfer;
    injectWebhookEvent(svc, {
      id: "evt_reversal_123",
      type: "transfer.reversed",
      data: { object: transfer },
    } as Stripe.Event);

    const result = await svc.handleWebhook("{}", "sig");

    expect(result.processed).toBe(true);
    expect(payoutService.reconcileStripeTransfer).toHaveBeenCalledWith({
      stripeTransferId: "tr_reversed",
      payoutId: "po1",
      status: "reversed",
      stripeFee: undefined,
      failureReason: null,
      occurredAt: new Date(1_778_000_000 * 1000),
      stripeEventId: "evt_reversal_123",
      reversedAmountCents: 95000,
    });
  });
});

describe("StripeConnectService.initiateTransfer", () => {
  function makePayoutRepository(payoutData: Payout | null): IPayoutRepository {
    return {
      findById: vi.fn().mockResolvedValue(payoutData),
      updateStatus: vi.fn().mockResolvedValue(payoutData),
      list: vi.fn(),
      create: vi.fn(),
      insertLine: vi.fn(),
      listLines: vi.fn(),
      findUnlinkedCapturedPayments: vi.fn(),
      listLegalEntityIdsWithUnlinkedCapturedPayments: vi.fn(),
      updateTotals: vi.fn(),
      updateXeroBillId: vi.fn(),
      findByStripeTransferId: vi.fn(),
      reconcileStripeTransfer: vi.fn(),
    } as unknown as IPayoutRepository;
  }

  function makeDomainEventPublisher(): DomainEventPublisher {
    return {
      publish: vi.fn().mockResolvedValue(undefined),
    } as unknown as DomainEventPublisher;
  }

  function makeMockDb(entityRow: { id: string; stripeConnectAccountId: string | null; stripeConnectPayoutsEnabled: boolean } | null): Database {
    const rows = entityRow ? [entityRow] : [];
    return {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(rows),
          }),
        }),
      }),
    } as unknown as Database;
  }

  it("returns stripe_not_configured when Stripe SDK is not available", async () => {
    const svc = new StripeConnectService(
      { ...baseEnv(), STRIPE_SECRET_KEY: undefined } as Env,
      {} as Database,
      makePayoutService(null),
    );

    const result = await svc.initiateTransfer("po1");

    expect(result).toEqual({ ok: false, reason: "stripe_not_configured" });
  });

  it("returns payout_not_found when payout does not exist", async () => {
    const payoutRepo = makePayoutRepository(null);
    const svc = new StripeConnectService(
      baseEnv(),
      {} as Database,
      makePayoutService(null),
      payoutRepo,
      makeDomainEventPublisher(),
    );

    const result = await svc.initiateTransfer("missing_payout");

    expect(result).toEqual({ ok: false, reason: "payout_not_found" });
  });

  it("returns payout_already_processed when payout is not scheduled", async () => {
    const payoutRepo = makePayoutRepository(payout({ status: "paid" }));
    const svc = new StripeConnectService(
      baseEnv(),
      {} as Database,
      makePayoutService(null),
      payoutRepo,
      makeDomainEventPublisher(),
    );

    const result = await svc.initiateTransfer("po1");

    expect(result).toEqual({ ok: false, reason: "payout_already_processed" });
  });

  it("returns no_connect_account when entity has no Stripe account", async () => {
    const payoutRepo = makePayoutRepository(payout({ status: "scheduled" }));
    const db = makeMockDb({ id: "le1", stripeConnectAccountId: null, stripeConnectPayoutsEnabled: false });
    const svc = new StripeConnectService(
      baseEnv(),
      db,
      makePayoutService(null),
      payoutRepo,
      makeDomainEventPublisher(),
    );

    const result = await svc.initiateTransfer("po1");

    expect(result).toEqual({ ok: false, reason: "no_connect_account" });
  });

  it("returns connect_not_ready when Connect payouts are disabled", async () => {
    const payoutRepo = makePayoutRepository(payout({ status: "scheduled" }));
    const db = makeMockDb({ id: "le1", stripeConnectAccountId: "acct_123", stripeConnectPayoutsEnabled: false });
    const publisher = makeDomainEventPublisher();
    const svc = new StripeConnectService(
      baseEnv(),
      db,
      makePayoutService(null),
      payoutRepo,
      publisher,
    );

    const result = await svc.initiateTransfer("po1");

    expect(result).toEqual({ ok: false, reason: "connect_not_ready" });
    expect(publisher.publish).toHaveBeenCalledWith(db, {
      aggregateType: "payout",
      aggregateId: "po1",
      eventType: "payout.transfer_blocked",
      payload: {
        payoutId: "po1",
        legalEntityId: "le1",
        reason: "connect_not_ready",
      },
      actorUserId: null,
      actingLegalEntityId: "le1",
    });
  });

  it("skips transfer for zero amount payouts and marks as paid", async () => {
    const payoutRepo = makePayoutRepository(payout({ status: "scheduled", netAmount: "0.00" }));
    const db = makeMockDb({ id: "le1", stripeConnectAccountId: "acct_123", stripeConnectPayoutsEnabled: true });
    const svc = new StripeConnectService(
      baseEnv(),
      db,
      makePayoutService(null),
      payoutRepo,
      makeDomainEventPublisher(),
    );

    const result = await svc.initiateTransfer("po1");

    expect(result).toEqual({ ok: true, stripeTransferId: "zero_amount_skipped" });
    expect(payoutRepo.updateStatus).toHaveBeenCalledWith("po1", expect.objectContaining({ status: "paid" }));
  });
});
