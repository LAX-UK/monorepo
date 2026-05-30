import type { Database } from "@auction/db";
import type { Payout } from "@auction/types";
import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../env.js";
import type { IStripeClientFactory } from "../../lib/stripe-client.js";
import { tryClaimProcessedStripeEvent } from "../../lib/stripe-processed-event.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { IPayoutRepository } from "../interfaces/payout-repository.js";
import type { IPayoutService } from "../interfaces/payout.js";
import { StripeConnectService } from "./stripe-connect.service.js";

vi.mock("../../lib/stripe-processed-event.js", () => ({
  tryClaimProcessedStripeEvent: vi.fn().mockResolvedValue({ claimed: true }),
}));

function baseEnv(overrides: Partial<Env> = {}): Env {
  return {
    STRIPE_SECRET_KEY: "sk_test_dummy",
    STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_dummy",
    WEB_ORIGIN: "https://app.test",
    LOG_LEVEL: "info",
    NODE_ENV: "test",
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
    runBulkSettlement: vi.fn(),
    runBulkSettlementWithTransfers: vi.fn(),
    addAdjustment: vi.fn(),
    markPaid: vi.fn(),
    reconcileStripeTransfer: vi.fn().mockResolvedValue(result),
  } as unknown as IPayoutService;
}

function makeDomainEventPublisher(): DomainEventPublisher {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
  } as unknown as DomainEventPublisher;
}

function makeStripeFactory(stripe: Stripe): IStripeClientFactory {
  return {
    get: () => stripe,
    require: () => stripe,
  };
}

function makeTransactionDb(inner: Database = {} as Database): Database {
  return {
    transaction: vi.fn(async (fn: (tx: Database) => Promise<unknown>) => fn(inner)),
  } as unknown as Database;
}

function injectStripeOnService(service: StripeConnectService, stripe: Stripe): void {
  const factory = makeStripeFactory(stripe);
  const inner = service as unknown as {
    accountService?: { stripeFactory: IStripeClientFactory };
    sessionService?: { stripeFactory: IStripeClientFactory };
    linkService?: { stripeFactory: IStripeClientFactory };
    webhookHandler?: { stripeFactory: IStripeClientFactory };
    transferService?: { stripeFactory: IStripeClientFactory };
    stripeFactory?: IStripeClientFactory;
  };
  if (inner.accountService) inner.accountService.stripeFactory = factory;
  if (inner.sessionService) inner.sessionService.stripeFactory = factory;
  if (inner.linkService) inner.linkService.stripeFactory = factory;
  if (inner.webhookHandler) inner.webhookHandler.stripeFactory = factory;
  if (inner.transferService) inner.transferService.stripeFactory = factory;
  if (inner.stripeFactory) inner.stripeFactory = factory;
}

describe("StripeConnectService.handleTransferEvent", () => {
  it("reconciles transfer.created as paid (transfers complete synchronously)", async () => {
    const payoutService = makePayoutService(payout());
    const svc = new StripeConnectService(baseEnv(), makeTransactionDb(), payoutService);
    const transfer = {
      id: "tr_1",
      created: 1_778_000_000,
      metadata: { payoutId: "po1" },
      balance_transaction: { fee: 210 },
    } as unknown as Stripe.Transfer;

    const result = await svc.handleTransferEvent({
      id: "evt_tr_1",
      type: "transfer.created",
      data: { object: transfer },
    } as Stripe.Event);

    expect(result.processed).toBe(true);
    expect(payoutService.reconcileStripeTransfer).toHaveBeenCalledWith({
      stripeTransferId: "tr_1",
      payoutId: "po1",
      status: "paid",
      stripeFee: "2.10",
      failureReason: null,
      occurredAt: new Date(1_778_000_000 * 1000),
    });
  });

  it("returns processed false when no local payout matches a transfer.created", async () => {
    const payoutService = makePayoutService(null);
    const svc = new StripeConnectService(baseEnv(), makeTransactionDb(), payoutService);

    const result = await svc.handleTransferEvent({
      id: "evt_tr_2",
      type: "transfer.created",
      data: {
        object: {
          id: "tr_missing",
          created: 1_778_000_000,
          metadata: {},
          balance_transaction: null,
        } as Stripe.Transfer,
      },
    } as Stripe.Event);

    expect(result.processed).toBe(false);
    expect(payoutService.reconcileStripeTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeTransferId: "tr_missing",
        status: "paid",
      }),
    );
  });

  it("dedups transfer.updated (metadata-only) and never overwrites prior status", async () => {
    const payoutService = makePayoutService(payout());
    const svc = new StripeConnectService(baseEnv(), makeTransactionDb(), payoutService);

    const result = await svc.handleTransferEvent({
      id: "evt_tr_meta",
      type: "transfer.updated",
      data: {
        object: {
          id: "tr_meta",
          created: 1_778_000_000,
          metadata: { payoutId: "po1" },
          balance_transaction: null,
        } as unknown as Stripe.Transfer,
      },
    } as Stripe.Event);

    expect(result.processed).toBe(true);
    expect(payoutService.reconcileStripeTransfer).not.toHaveBeenCalled();
  });

  it("reconciles transfer.reversed with stripeEventId and reversedAmountCents", async () => {
    const payoutService = makePayoutService(payout({ status: "reversed" }));
    const svc = new StripeConnectService(baseEnv(), makeTransactionDb(), payoutService);
    const transfer = {
      id: "tr_reversed",
      created: 1_778_000_000,
      metadata: { payoutId: "po1" },
      balance_transaction: null,
      amount: 95000,
      amount_reversed: 95000,
    } as unknown as Stripe.Transfer;

    const result = await svc.handleTransferEvent({
      id: "evt_reversal_123",
      type: "transfer.reversed",
      data: { object: transfer },
    } as Stripe.Event);

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
      updateStatusIfCurrent: vi
        .fn()
        .mockResolvedValue(payoutData ? { ...payoutData, status: "in_transit" as const } : null),
      list: vi.fn(),
      create: vi.fn(),
      insertLine: vi.fn(),
      listLines: vi.fn(),
      findUnlinkedCapturedPayments: vi.fn(),
      listLegalEntityIdsWithUnlinkedCapturedPayments: vi.fn(),
      listScheduledPayoutsAwaitingTransfer: vi.fn().mockResolvedValue([]),
      updateTotals: vi.fn(),
      updateXeroBillId: vi.fn(),
      findByStripeTransferId: vi.fn(),
      reconcileStripeTransfer: vi.fn(),
    } as unknown as IPayoutRepository;
  }

  function makeMockDb(
    entityRow: {
      id: string;
      stripeConnectAccountId: string | null;
      stripeConnectPayoutsEnabled: boolean;
    } | null,
  ): Database {
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
    const db = makeMockDb({
      id: "le1",
      stripeConnectAccountId: null,
      stripeConnectPayoutsEnabled: false,
    });
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
    const db = makeMockDb({
      id: "le1",
      stripeConnectAccountId: "acct_123",
      stripeConnectPayoutsEnabled: false,
    });
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
    const db = makeMockDb({
      id: "le1",
      stripeConnectAccountId: "acct_123",
      stripeConnectPayoutsEnabled: true,
    });
    const svc = new StripeConnectService(
      baseEnv(),
      db,
      makePayoutService(null),
      payoutRepo,
      makeDomainEventPublisher(),
    );

    const result = await svc.initiateTransfer("po1");

    expect(result).toEqual({ ok: true, stripeTransferId: "zero_amount_skipped" });
    expect(payoutRepo.updateStatus).toHaveBeenCalledWith(
      "po1",
      expect.objectContaining({ status: "paid" }),
    );
  });

  it("marks negative net payouts as clawback_pending without loading Stripe Connect", async () => {
    const payoutRepo = makePayoutRepository(payout({ status: "scheduled", netAmount: "-100.00" }));
    const publisher = makeDomainEventPublisher();
    const db = makeMockDb({
      id: "le1",
      stripeConnectAccountId: "acct_123",
      stripeConnectPayoutsEnabled: true,
    });
    const svc = new StripeConnectService(
      baseEnv(),
      db,
      makePayoutService(null),
      payoutRepo,
      publisher,
    );

    const result = await svc.initiateTransfer("po1");

    expect(result).toEqual({ ok: false, reason: "negative_net_amount" });
    expect(payoutRepo.updateStatus).toHaveBeenCalledWith(
      "po1",
      expect.objectContaining({
        status: "clawback_pending",
        stripeTransferId: null,
        failureReason: "negative_net_amount",
      }),
    );
    expect(publisher.publish).toHaveBeenCalledWith(db, {
      aggregateType: "payout",
      aggregateId: "po1",
      eventType: "payout.clawback_required",
      payload: {
        payoutId: "po1",
        legalEntityId: "le1",
        netAmount: "-100.00",
        currency: "GBP",
        reason: "negative_net_amount",
      },
      actorUserId: null,
      actingLegalEntityId: "le1",
    });
  });

  it("keepScheduledOnTransferFailure leaves payout scheduled after non-retryable stripe errors", async () => {
    const StripeSdk = await import("stripe");
    const rejectErr = new StripeSdk.default.errors.StripeInvalidRequestError({
      message: "card declined",
      type: "invalid_request_error",
      code: "card_declined",
    } as never);
    const payoutRow = payout({ status: "scheduled", netAmount: "10.00", stripeTransferId: null });
    const updateStatus = vi.fn().mockResolvedValue({ ...payoutRow, status: "scheduled" as const });
    const payoutRepo = {
      findById: vi.fn().mockResolvedValue(payoutRow),
      updateStatus,
      list: vi.fn(),
      create: vi.fn(),
      insertLine: vi.fn(),
      listLines: vi.fn().mockResolvedValue([]),
      findUnlinkedCapturedPayments: vi.fn(),
      listLegalEntityIdsWithUnlinkedCapturedPayments: vi.fn(),
      listScheduledPayoutsAwaitingTransfer: vi.fn().mockResolvedValue([]),
      updateTotals: vi.fn(),
      updateXeroBillId: vi.fn(),
      findByStripeTransferId: vi.fn(),
      reconcileStripeTransfer: vi.fn(),
    } as unknown as IPayoutRepository;
    const db = makeMockDb({
      id: "le1",
      stripeConnectAccountId: "acct_123",
      stripeConnectPayoutsEnabled: true,
    });
    const publisher = makeDomainEventPublisher();
    const svc = new StripeConnectService(
      baseEnv(),
      db,
      makePayoutService(null),
      payoutRepo,
      publisher,
    );
    injectStripeOnService(svc, {
      transfers: {
        create: vi.fn().mockRejectedValue(rejectErr),
      },
    } as unknown as Stripe);
    const result = await svc.initiateTransfer("po1", { keepScheduledOnTransferFailure: true });
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        reason: "stripe_error",
        stripeErrorCode: "card_declined",
      }),
    );
    expect(
      updateStatus.mock.calls.some(
        (c) =>
          c[0] === "po1" &&
          c[1].status === "scheduled" &&
          String(c[1].failureReason).includes("stripe_transfer_failed"),
      ),
    ).toBe(true);
    expect(publisher.publish).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ eventType: "payout.transfer_failed", aggregateId: "po1" }),
    );
  });

  it("omits source_transaction when charge currency mismatches payout currency", async () => {
    const payoutRow = payout({ status: "scheduled", netAmount: "10.00", currency: "GBP" });
    const updateStatusIfCurrent = vi
      .fn()
      .mockResolvedValue({ ...payoutRow, status: "in_transit" as const, stripeTransferId: "tr_1" });
    const payoutRepo = {
      findById: vi.fn().mockResolvedValue(payoutRow),
      updateStatus: vi.fn(),
      updateStatusIfCurrent,
      list: vi.fn(),
      create: vi.fn(),
      insertLine: vi.fn(),
      listLines: vi.fn().mockResolvedValue([{ kind: "sale", paymentId: "pay_1" }]),
      findUnlinkedCapturedPayments: vi.fn(),
      listLegalEntityIdsWithUnlinkedCapturedPayments: vi.fn(),
      listScheduledPayoutsAwaitingTransfer: vi.fn().mockResolvedValue([]),
      updateTotals: vi.fn(),
      updateXeroBillId: vi.fn(),
      findByStripeTransferId: vi.fn(),
      reconcileStripeTransfer: vi.fn(),
    } as unknown as IPayoutRepository;

    const entitySelect = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: "le1",
              stripeConnectAccountId: "acct_123",
              stripeConnectPayoutsEnabled: true,
              stripeConnectRequirementsCurrentlyDue: [],
              status: "approved",
              isLaxManaged: false,
            },
          ]),
        }),
      }),
    };
    const paymentSelect = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ stripeChargeId: "ch_1" }]),
        }),
      }),
    };
    const db = {
      select: vi
        .fn()
        .mockReturnValueOnce(entitySelect)
        .mockReturnValueOnce(entitySelect)
        .mockReturnValueOnce(paymentSelect),
    } as unknown as Database;

    const transfersCreate = vi.fn().mockResolvedValue({ id: "tr_1" });
    const chargesRetrieve = vi.fn().mockResolvedValue({ currency: "eur" });
    const svc = new StripeConnectService(
      baseEnv(),
      db,
      makePayoutService(null),
      payoutRepo,
      makeDomainEventPublisher(),
    );
    injectStripeOnService(svc, {
      transfers: { create: transfersCreate },
      charges: { retrieve: chargesRetrieve },
      accounts: {
        retrieve: vi.fn().mockRejectedValue(new Error("skip live sync")),
      },
    } as unknown as Stripe);

    const result = await svc.initiateTransfer("po1");

    expect(result).toEqual({ ok: true, stripeTransferId: "tr_1" });
    expect(chargesRetrieve).toHaveBeenCalledWith("ch_1");
    expect(transfersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1000,
        currency: "gbp",
        destination: "acct_123",
      }),
      { idempotencyKey: "payout:transfer:po1" },
    );
    expect(transfersCreate.mock.calls[0]?.[0]).not.toHaveProperty("source_transaction");
    expect(updateStatusIfCurrent).toHaveBeenCalledWith(
      "po1",
      "scheduled",
      expect.objectContaining({ status: "in_transit", stripeTransferId: "tr_1" }),
    );
  });

  it("does not downgrade paid payout when scheduled-to-in_transit CAS fails", async () => {
    const payoutRow = payout({ status: "scheduled", netAmount: "10.00", currency: "GBP" });
    const paidRow = payout({
      status: "paid",
      netAmount: "10.00",
      stripeTransferId: "tr_1",
      processedAt: new Date(),
    });
    const updateStatusIfCurrent = vi.fn().mockResolvedValue(null);
    const updateStatus = vi.fn();
    const findById = vi.fn().mockResolvedValueOnce(payoutRow).mockResolvedValueOnce(paidRow);
    const payoutRepo = {
      findById,
      updateStatus,
      updateStatusIfCurrent,
      list: vi.fn(),
      create: vi.fn(),
      insertLine: vi.fn(),
      listLines: vi.fn().mockResolvedValue([]),
      findUnlinkedCapturedPayments: vi.fn(),
      listLegalEntityIdsWithUnlinkedCapturedPayments: vi.fn(),
      listScheduledPayoutsAwaitingTransfer: vi.fn().mockResolvedValue([]),
      updateTotals: vi.fn(),
      updateXeroBillId: vi.fn(),
      findByStripeTransferId: vi.fn(),
      reconcileStripeTransfer: vi.fn(),
    } as unknown as IPayoutRepository;

    const entitySelect = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: "le1",
              stripeConnectAccountId: "acct_123",
              stripeConnectPayoutsEnabled: true,
              stripeConnectRequirementsCurrentlyDue: [],
              status: "approved",
              isLaxManaged: false,
            },
          ]),
        }),
      }),
    };
    const db = {
      select: vi.fn().mockReturnValueOnce(entitySelect).mockReturnValueOnce(entitySelect),
    } as unknown as Database;

    const transfersCreate = vi.fn().mockResolvedValue({ id: "tr_1" });
    const publisher = makeDomainEventPublisher();
    const svc = new StripeConnectService(
      baseEnv(),
      db,
      makePayoutService(null),
      payoutRepo,
      publisher,
    );
    injectStripeOnService(svc, {
      transfers: { create: transfersCreate },
      accounts: {
        retrieve: vi.fn().mockRejectedValue(new Error("skip live sync")),
      },
    } as unknown as Stripe);

    const result = await svc.initiateTransfer("po1");

    expect(result).toEqual({ ok: true, stripeTransferId: "tr_1" });
    expect(updateStatusIfCurrent).toHaveBeenCalledWith(
      "po1",
      "scheduled",
      expect.objectContaining({ status: "in_transit", stripeTransferId: "tr_1" }),
    );
    expect(updateStatus).not.toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
  });
});

describe("StripeConnectService.ensureAccount", () => {
  it("creates individual Express account with business_type individual", async () => {
    const entityRow = {
      id: "le1",
      displayName: "Ada",
      legalName: null,
      slug: null,
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: "user-1",
      status: "lead",
      statusChangedAt: null,
      statusChangedByUserId: null,
      stripeConnectAccountId: null,
      stripeConnectChargesEnabled: false,
      stripeConnectPayoutsEnabled: false,
      stripeConnectRequirementsCurrentlyDue: [],
      stripeConnectDisabledReason: null,
      xeroContactId: null,
      vatNumber: null,
      marginSchemeEligible: false,
      isLaxManaged: false,
      platformFeeBps: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const updatedRow = {
      ...entityRow,
      stripeConnectAccountId: "acct_test_1",
      status: "connect_pending" as const,
    };
    const accountsCreate = vi.fn().mockResolvedValue({ id: "acct_test_1" });
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  entity: entityRow,
                  ownerEmail: "ada@example.com",
                  ownerFirstName: "Ada",
                  ownerLastName: "Lovelace",
                  ownerDisplayName: "Ada Lovelace",
                  ownerKycStatus: "approved",
                },
              ]),
            }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedRow]),
          }),
        }),
      }),
    } as unknown as Database;

    const svc = new StripeConnectService(baseEnv(), db, makePayoutService(null));
    injectStripeOnService(svc, { accounts: { create: accountsCreate } } as unknown as Stripe);

    const result = await svc.ensureAccount("le1", "GB");

    expect(accountsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        country: "GB",
        business_type: "individual",
        controller: {
          fees: { payer: "application" },
          losses: { payments: "application" },
          stripe_dashboard: { type: "express" },
        },
        individual: {
          first_name: "Ada",
          last_name: "Lovelace",
          email: "ada@example.com",
        },
        capabilities: { transfers: { requested: true } },
      }),
      { idempotencyKey: "connect:account:le1" },
    );
    expect(result.stripeAccountId).toBe("acct_test_1");
    expect(result.legalEntity.status).toBe("connect_pending");
  });

  it("creates organisation Express account with company business_type", async () => {
    const entityRow = {
      id: "le-org",
      displayName: "Gallery",
      legalName: "Gallery Ltd",
      slug: null,
      kind: "organisation",
      subkind: "gallery",
      createdByUserId: "user-1",
      status: "lead",
      statusChangedAt: null,
      statusChangedByUserId: null,
      stripeConnectAccountId: null,
      stripeConnectChargesEnabled: false,
      stripeConnectPayoutsEnabled: false,
      stripeConnectRequirementsCurrentlyDue: [],
      stripeConnectDisabledReason: null,
      xeroContactId: null,
      vatNumber: null,
      marginSchemeEligible: false,
      isLaxManaged: false,
      platformFeeBps: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const updatedRow = {
      ...entityRow,
      stripeConnectAccountId: "acct_org",
      status: "lead" as const,
    };
    const accountsCreate = vi.fn().mockResolvedValue({ id: "acct_org" });
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  entity: entityRow,
                  ownerEmail: "owner@example.com",
                  ownerFirstName: null,
                  ownerLastName: null,
                  ownerDisplayName: "Gallery Owner",
                },
              ]),
            }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedRow]),
          }),
        }),
      }),
    } as unknown as Database;

    const svc = new StripeConnectService(baseEnv(), db, makePayoutService(null));
    injectStripeOnService(svc, { accounts: { create: accountsCreate } } as unknown as Stripe);

    await svc.ensureAccount("le-org", "GB");

    expect(accountsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        business_type: "company",
        metadata: expect.objectContaining({ legalEntityId: "le-org" }),
      }),
      { idempotencyKey: "connect:account:le-org" },
    );
  });
});

describe("StripeConnectService.handleConnectedAccountEvent dedup", () => {
  beforeEach(() => {
    vi.mocked(tryClaimProcessedStripeEvent).mockReset();
    vi.mocked(tryClaimProcessedStripeEvent).mockResolvedValue({ claimed: true });
  });

  it("skips applyAccountUpdate when event was already processed", async () => {
    vi.mocked(tryClaimProcessedStripeEvent).mockResolvedValueOnce({ claimed: false });
    const publisher = makeDomainEventPublisher();
    const db = makeTransactionDb({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      update: vi.fn(),
    } as unknown as Database);

    const svc = new StripeConnectService(
      baseEnv(),
      db,
      makePayoutService(null),
      undefined,
      publisher,
    );
    injectStripeOnService(svc, {
      accounts: {
        retrieve: vi.fn().mockResolvedValue({
          id: "acct_1",
          charges_enabled: true,
          payouts_enabled: true,
          requirements: { currently_due: [] },
        }),
      },
    } as unknown as Stripe);

    const result = await svc.handleConnectedAccountEvent({
      id: "evt_acct_1",
      type: "account.updated",
      data: {
        object: {
          id: "acct_1",
          charges_enabled: true,
          payouts_enabled: true,
          requirements: { currently_due: [] },
        },
      },
    } as unknown as Stripe.Event);

    expect(result.processed).toBe(true);
    expect(publisher.publish).not.toHaveBeenCalled();
  });
});
