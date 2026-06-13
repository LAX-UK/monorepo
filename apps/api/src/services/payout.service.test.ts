import type { Database } from "@auction/db";
import type { Payout, PayoutLine } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { IPayoutRepository, PendingPaymentRow } from "./interfaces/payout-repository.js";
import {
  PayoutNotFoundError,
  PayoutPermissionError,
  PayoutStatusTransitionError,
} from "./interfaces/payout.js";
import type { InitiateTransferResult } from "./interfaces/stripe-connect.js";
import { PayoutService } from "./payout.service.js";

const ENTITY_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ENTITY_ID = "00000000-0000-4000-8000-000000000099";
const ACTOR_ID = "user-actor";

function makeRepo(overrides: Partial<IPayoutRepository> = {}): IPayoutRepository {
  const insertLine = overrides.insertLine ?? vi.fn();
  return {
    create: vi.fn(),
    insertLine,
    tryInsertSaleLine:
      overrides.tryInsertSaleLine ??
      vi.fn(async (input) => {
        const fn = insertLine as (input: unknown) => Promise<PayoutLine>;
        return fn(input);
      }),
    list: vi.fn().mockResolvedValue([]),
    countMatching: vi.fn().mockResolvedValue(0),
    countCreatedAtByDay: vi.fn().mockResolvedValue(new Map()),
    findById: vi.fn().mockResolvedValue(null),
    findByStripeTransferId: vi.fn().mockResolvedValue(null),
    listLines: vi.fn().mockResolvedValue([]),
    findUnlinkedCapturedPayments: vi.fn().mockResolvedValue([]),
    listLegalEntityIdsWithUnlinkedCapturedPayments: vi.fn().mockResolvedValue([]),
    updateTotals: vi.fn(),
    updateStatus: vi.fn(),
    updateStatusIfCurrent: vi.fn().mockResolvedValue(null),
    updateXeroBillId: vi.fn(),
    reconcileStripeTransfer: vi.fn(),
    setStatementUrl: vi.fn(),
    setStatementGenerationError: vi.fn(),
    clearStatementGenerationError: vi.fn(),
    findOpenPayoutForEntity: vi.fn().mockResolvedValue(null),
    lineExistsForSourceEvent: vi.fn().mockResolvedValue(false),
    listScheduledPayoutsAwaitingTransfer: vi.fn().mockResolvedValue([]),
    sumRefundLineCentsForPayment: vi.fn().mockResolvedValue(0),
    findLineForPaymentAndKind: vi.fn().mockResolvedValue(null),
    updateLineAmount: vi.fn(),
    ...overrides,
  };
}

function pending(rows: Partial<PendingPaymentRow>[]): PendingPaymentRow[] {
  return rows.map((r, i) => ({
    id: r.id ?? `p${i + 1}`,
    amount: r.amount ?? "100.00",
    platformFee: r.platformFee ?? "5.00",
    capturedAt: r.capturedAt ?? new Date(`2026-01-0${i + 1}T00:00:00Z`),
    ...(r.settlementAmount !== undefined ? { settlementAmount: r.settlementAmount } : {}),
  }));
}

function payout(overrides: Partial<Payout> = {}): Payout {
  return {
    id: "po1",
    legalEntityId: ENTITY_ID,
    periodStart: new Date("2026-01-01"),
    periodEnd: new Date("2026-01-31"),
    grossAmount: "1000.00",
    platformFee: "50.00",
    stripeFee: "0.00",
    netAmount: "950.00",
    currency: "GBP",
    status: "scheduled",
    stripeTransferId: null,
    xeroBillId: null,
    failureReason: null,
    processedAt: null,
    statementUrl: null,
    statementGenerationError: null,
    createdAt: new Date("2026-02-01"),
    ...overrides,
  };
}

describe("PayoutService.previewPending", () => {
  it("returns zeros when no captured payments are pending", async () => {
    const repo = makeRepo({
      findUnlinkedCapturedPayments: vi.fn().mockResolvedValue([]),
    });
    const svc = new PayoutService(repo);
    await expect(svc.previewPending(ENTITY_ID)).resolves.toEqual({
      pendingGross: "0.00",
      pendingPlatformFee: "0.00",
      pendingNet: "0.00",
      paymentCount: 0,
      currency: "GBP",
    });
  });

  it("aggregates gross / fee / net across captured payments", async () => {
    const repo = makeRepo({
      findUnlinkedCapturedPayments: vi.fn().mockResolvedValue(
        pending([
          { amount: "100.00", platformFee: "5.00" },
          { amount: "250.50", platformFee: "12.53" },
          { amount: "1000.00", platformFee: "50.00" },
        ]),
      ),
    });
    const svc = new PayoutService(repo);
    const preview = await svc.previewPending(ENTITY_ID);
    expect(preview.pendingGross).toBe("1350.50");
    expect(preview.pendingPlatformFee).toBe("67.53");
    expect(preview.pendingNet).toBe("1282.97");
    expect(preview.paymentCount).toBe(3);
  });
});

describe("PayoutService.createSettlement", () => {
  it("returns no_pending_payments when nothing to settle", async () => {
    const svc = new PayoutService(makeRepo());
    const r = await svc.createSettlement(ACTOR_ID, {
      legalEntityId: ENTITY_ID,
      periodStart: new Date(0),
      periodEnd: new Date(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_pending_payments");
  });

  it("creates a payout with one sale-line per pending payment", async () => {
    const created = payout({
      id: "po-new",
      grossAmount: "350.00",
      platformFee: "17.50",
      netAmount: "332.50",
    });
    const insertedLines: PayoutLine[] = [];
    const insertLine = vi.fn(async (input) => {
      const line: PayoutLine = {
        id: `line-${insertedLines.length + 1}`,
        payoutId: input.payoutId,
        paymentId: input.paymentId ?? null,
        amount: input.amount,
        kind: input.kind,
        createdByUserId: input.createdByUserId ?? null,
        note: input.note ?? null,
        createdAt: new Date(),
      };
      insertedLines.push(line);
      return line;
    });

    const repo = makeRepo({
      findUnlinkedCapturedPayments: vi.fn().mockResolvedValue(
        pending([
          { id: "pay-a", amount: "100.00", platformFee: "5.00" },
          { id: "pay-b", amount: "250.00", platformFee: "12.50" },
        ]),
      ),
      create: vi.fn().mockResolvedValue(created),
      insertLine,
      tryInsertSaleLine: insertLine,
    });
    const svc = new PayoutService(repo);
    const result = await svc.createSettlement(ACTOR_ID, {
      legalEntityId: ENTITY_ID,
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-01-31"),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payout.id).toBe("po-new");
      expect(result.payout.lines).toHaveLength(2);
      expect(result.payout.lines.every((l) => l.kind === "sale")).toBe(true);
    }

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        legalEntityId: ENTITY_ID,
        grossAmount: "350.00",
        platformFee: "17.50",
        netAmount: "332.50",
        currency: "GBP",
      }),
    );
    expect(insertLine).toHaveBeenCalledTimes(2);
    expect(insertLine).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ paymentId: "pay-a", amount: "100.00", kind: "sale" }),
    );
  });

  it("settles at gross sale line when a partial refund clawback exists (Option A)", async () => {
    const created = payout({
      id: "po-partial",
      grossAmount: "100.00",
      platformFee: "5.00",
      netAmount: "95.00",
    });
    const insertLine = vi.fn(async (input) => ({
      id: "line-1",
      payoutId: input.payoutId,
      paymentId: input.paymentId ?? null,
      amount: input.amount,
      kind: input.kind,
      createdByUserId: input.createdByUserId ?? null,
      note: input.note ?? null,
      createdAt: new Date(),
    }));
    const repo = makeRepo({
      findUnlinkedCapturedPayments: vi.fn().mockResolvedValue(
        pending([
          {
            id: "pay-partial",
            amount: "100.00",
            platformFee: "5.00",
            settlementAmount: "100.00",
          },
        ]),
      ),
      create: vi.fn().mockResolvedValue(created),
      tryInsertSaleLine: insertLine,
    });
    const svc = new PayoutService(repo);
    const result = await svc.createSettlement(ACTOR_ID, {
      legalEntityId: ENTITY_ID,
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-01-31"),
    });

    expect(result.ok).toBe(true);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        grossAmount: "100.00",
        platformFee: "5.00",
        netAmount: "95.00",
      }),
    );
    expect(insertLine).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: "pay-partial", amount: "100.00", kind: "sale" }),
    );
  });
});

describe("PayoutService.getById", () => {
  it("forbids cross-entity access (404 surface via permission error)", async () => {
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(payout({ legalEntityId: OTHER_ENTITY_ID })),
    });
    const svc = new PayoutService(repo);
    await expect(svc.getById(ENTITY_ID, "po1")).rejects.toBeInstanceOf(PayoutPermissionError);
  });

  it("throws PayoutNotFoundError when missing", async () => {
    const svc = new PayoutService(makeRepo());
    await expect(svc.getById(ENTITY_ID, "missing")).rejects.toBeInstanceOf(PayoutNotFoundError);
  });
});

describe("PayoutService.addAdjustment", () => {
  it("rejects adjustments on terminal-state payouts", async () => {
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(payout({ status: "paid" })),
    });
    const svc = new PayoutService(repo);
    await expect(
      svc.addAdjustment(ACTOR_ID, "po1", { amount: "10.00", note: "long enough note" }),
    ).rejects.toBeInstanceOf(PayoutStatusTransitionError);
  });

  it("appends a positive adjustment and recomputes totals", async () => {
    const before = payout({ grossAmount: "1000.00", platformFee: "50.00", netAmount: "950.00" });
    const newLine: PayoutLine = {
      id: "adj1",
      payoutId: before.id,
      paymentId: null,
      amount: "100.00",
      kind: "adjustment",
      createdByUserId: ACTOR_ID,
      note: "manual top-up",
      createdAt: new Date(),
    };
    const after = payout({
      grossAmount: "1100.00",
      platformFee: "50.00",
      netAmount: "1050.00",
    });
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(after),
      insertLine: vi.fn().mockResolvedValue(newLine),
      updateTotals: vi.fn().mockResolvedValue(after),
      listLines: vi.fn().mockResolvedValue([newLine]),
    });
    const svc = new PayoutService(repo);
    const result = await svc.addAdjustment(ACTOR_ID, "po1", {
      amount: "100.00",
      note: "manual top-up",
    });
    expect(result.grossAmount).toBe("1100.00");
    expect(result.netAmount).toBe("1050.00");
    expect(result.lines).toHaveLength(1);
    expect(repo.updateTotals).toHaveBeenCalledWith("po1", {
      grossAmount: "1100.00",
      platformFee: "50.00",
      netAmount: "1050.00",
    });
  });

  it("appends a negative adjustment correctly", async () => {
    const before = payout({ grossAmount: "1000.00", platformFee: "50.00", netAmount: "950.00" });
    const after = payout({
      grossAmount: "950.00",
      platformFee: "50.00",
      netAmount: "900.00",
    });
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(before),
      insertLine: vi.fn().mockResolvedValue({} as PayoutLine),
      updateTotals: vi.fn().mockResolvedValue(after),
      listLines: vi.fn().mockResolvedValue([]),
    });
    const svc = new PayoutService(repo);
    await svc.addAdjustment(ACTOR_ID, "po1", {
      amount: "-50.00",
      note: "deduction reason",
    });
    expect(repo.updateTotals).toHaveBeenCalledWith("po1", {
      grossAmount: "950.00",
      platformFee: "50.00",
      netAmount: "900.00",
    });
  });
});

describe("PayoutService.markPaid", () => {
  it("rejects markPaid when already paid", async () => {
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(payout({ status: "paid" })),
    });
    const svc = new PayoutService(repo);
    await expect(svc.markPaid(ACTOR_ID, "po1", { stripeTransferId: "tr_1" })).rejects.toMatchObject(
      { code: "payout_already_paid" },
    );
  });

  it("rejects markPaid on reversed/failed", async () => {
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(payout({ status: "reversed" })),
    });
    const svc = new PayoutService(repo);
    await expect(svc.markPaid(ACTOR_ID, "po1", { stripeTransferId: "tr_1" })).rejects.toMatchObject(
      { code: "cannot_pay_payout_in_state" },
    );
  });

  it("transitions to paid with the supplied transfer id and a processedAt", async () => {
    const before = payout({ status: "scheduled" });
    const updated = payout({
      status: "paid",
      stripeTransferId: "tr_test_1",
      processedAt: new Date(),
    });
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(before),
      updateStatus: vi.fn().mockResolvedValue(updated),
    });
    const svc = new PayoutService(repo);
    const result = await svc.markPaid(ACTOR_ID, "po1", { stripeTransferId: "tr_test_1" });
    expect(result.status).toBe("paid");
    expect(repo.updateStatus).toHaveBeenCalledWith(
      "po1",
      expect.objectContaining({
        status: "paid",
        stripeTransferId: "tr_test_1",
        failureReason: null,
      }),
    );
  });
});

describe("PayoutService.reconcileStripeTransfer", () => {
  it("returns null when Stripe metadata / transfer id cannot match a payout", async () => {
    const repo = makeRepo({
      findByStripeTransferId: vi.fn().mockResolvedValue(null),
    });
    const svc = new PayoutService(repo);
    await expect(
      svc.reconcileStripeTransfer({
        stripeTransferId: "tr_missing",
        status: "paid",
      }),
    ).resolves.toBeNull();
  });

  it("uses payout metadata when present and marks transfer as paid (transfers complete synchronously)", async () => {
    const before = payout({ stripeTransferId: null, status: "scheduled" });
    const after = payout({ stripeTransferId: "tr_1", status: "paid" });
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(before),
      reconcileStripeTransfer: vi.fn().mockResolvedValue(after),
    });
    const svc = new PayoutService(repo);
    const result = await svc.reconcileStripeTransfer({
      stripeTransferId: "tr_1",
      payoutId: "po1",
      status: "paid",
      stripeFee: "2.10",
    });

    expect(result?.status).toBe("paid");
    expect(repo.findById).toHaveBeenCalledWith("po1");
    expect(repo.reconcileStripeTransfer).toHaveBeenCalledWith(
      "po1",
      expect.objectContaining({
        stripeTransferId: "tr_1",
        status: "paid",
        stripeFee: "2.10",
        failureReason: null,
      }),
    );
  });

  it("looks up by transfer id when payoutId not provided", async () => {
    const occurredAt = new Date("2026-05-01T10:00:00Z");
    const before = payout({ stripeTransferId: "tr_paid", status: "in_transit" });
    const after = payout({ stripeTransferId: "tr_paid", status: "paid", processedAt: occurredAt });
    const repo = makeRepo({
      findByStripeTransferId: vi.fn().mockResolvedValue(before),
      reconcileStripeTransfer: vi.fn().mockResolvedValue(after),
    });
    const svc = new PayoutService(repo);
    const result = await svc.reconcileStripeTransfer({
      stripeTransferId: "tr_paid",
      status: "paid",
      occurredAt,
    });

    expect(result?.status).toBe("paid");
    expect(repo.reconcileStripeTransfer).toHaveBeenCalledWith(
      "po1",
      expect.objectContaining({
        status: "paid",
        processedAt: occurredAt,
        failureReason: null,
      }),
    );
  });

  it("inserts negative payout line and emits payout.transfer_reversed event on reversal", async () => {
    const before = payout({ stripeTransferId: "tr_1", status: "paid" });

    const repo = makeRepo({
      findByStripeTransferId: vi.fn().mockResolvedValue(before),
    });
    const publish = vi.fn().mockResolvedValue(undefined);

    const payoutDbRow = {
      id: "po1",
      legalEntityId: "le1",
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-01-31"),
      grossAmount: "1000.00",
      platformFee: "50.00",
      stripeFee: "0.00",
      netAmount: "950.00",
      currency: "GBP",
      status: "paid",
      stripeTransferId: "tr_1",
      xeroBillId: null,
      failureReason: null,
      processedAt: null,
      statementUrl: null,
      statementGenerationError: null,
      createdAt: new Date("2026-02-01"),
    };
    const updatedDbRow = { ...payoutDbRow, status: "reversed" };

    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: "line-rev",
              payoutId: "po1",
              paymentId: null,
              amount: "-950.00",
              kind: "reversal",
              createdByUserId: null,
              note: "Transfer reversed: tr_1",
              sourceEventId: "evt_rev_123",
              createdAt: new Date(),
            },
          ]),
        }),
      }),
    });
    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([payoutDbRow]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedDbRow]),
          }),
        }),
      }),
      insert: mockInsert,
    };
    const db = {
      transaction: vi.fn().mockImplementation(async (fn) => fn(mockTx)),
    };
    const svc = new PayoutService(
      repo,
      db as unknown as Database,
      {
        publish,
      } as unknown as DomainEventPublisher,
    );

    const result = await svc.reconcileStripeTransfer({
      stripeTransferId: "tr_1",
      status: "reversed",
      stripeEventId: "evt_rev_123",
      reversedAmountCents: 95000,
    });

    expect(result?.status).toBe("reversed");
    expect(mockInsert).toHaveBeenCalled();
    expect(publish).toHaveBeenCalledTimes(1);
    const publishCall = publish.mock.calls[0]?.[1];
    expect(publishCall).toBeDefined();
    expect(publishCall.eventType).toBe("payout.transfer_reversed");
    expect(publishCall.aggregateId).toBe("po1");
    expect(publishCall.payload.reversedAmountCents).toBe(95000);
    expect(publishCall.payload.stripeEventId).toBe("evt_rev_123");
  });
});

describe("PayoutService.runBulkSettlement", () => {
  it("runs settlement once per eligible legal entity", async () => {
    const e1 = "00000000-0000-4000-8000-000000000001";
    const e2 = "00000000-0000-4000-8000-000000000002";
    const create = vi.fn().mockImplementation(async (input: { legalEntityId: string }) =>
      payout({
        id: `po-${input.legalEntityId.slice(0, 8)}`,
        legalEntityId: input.legalEntityId,
      }),
    );
    const insertLine = vi.fn().mockImplementation(async (input: { payoutId: string }) => ({
      id: `line-${input.payoutId}`,
      payoutId: input.payoutId,
      paymentId: "pay-1",
      amount: "10.00",
      kind: "sale" as const,
      createdByUserId: null,
      note: null,
      createdAt: new Date(),
    }));
    const repo = makeRepo({
      listLegalEntityIdsWithUnlinkedCapturedPayments: vi.fn().mockResolvedValue([e1, e2]),
      findUnlinkedCapturedPayments: vi
        .fn()
        .mockImplementation(async (id: string) =>
          id === e1 || id === e2
            ? pending([{ id: "p1", amount: "10.00", platformFee: "0.50" }])
            : [],
        ),
      create,
      insertLine,
    });
    const svc = new PayoutService(repo);
    const result = await svc.runBulkSettlement(null);
    expect(result.eligibleEntityCount).toBe(2);
    expect(result.createdCount).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items.every((i) => i.outcome === "created")).toBe(true);
    expect(create).toHaveBeenCalledTimes(2);
  });
});

describe("PayoutService.runBulkSettlementWithTransfers", () => {
  function entityId(i: number) {
    return `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
  }

  it("continues after Stripe failure on one entity and completes the rest", async () => {
    const entities = Array.from({ length: 10 }, (_, idx) => entityId(idx + 1));
    let transferCalls = 0;
    const initiateTransfer = vi.fn(async (): Promise<InitiateTransferResult> => {
      transferCalls++;
      if (transferCalls === 5) {
        return {
          ok: false,
          reason: "stripe_error",
          stripeErrorCode: "x",
          stripeErrorMessage: "nope",
        };
      }
      return { ok: true, stripeTransferId: `tr_${transferCalls}` };
    });
    const create = vi.fn().mockImplementation(async (input: { legalEntityId: string }) =>
      payout({
        id: `po-${input.legalEntityId.replace(/-/g, "").slice(-8)}`,
        legalEntityId: input.legalEntityId,
      }),
    );
    const insertLine = vi.fn().mockImplementation(async (input: { payoutId: string }) => ({
      id: `line-${input.payoutId}`,
      payoutId: input.payoutId,
      paymentId: "pay-1",
      amount: "10.00",
      kind: "sale" as const,
      createdByUserId: null,
      note: null,
      createdAt: new Date(),
    }));
    const repo = makeRepo({
      listLegalEntityIdsWithUnlinkedCapturedPayments: vi.fn().mockResolvedValue(entities),
      listScheduledPayoutsAwaitingTransfer: vi.fn().mockResolvedValue([]),
      findUnlinkedCapturedPayments: vi
        .fn()
        .mockImplementation(async (id: string) =>
          entities.includes(id)
            ? pending([{ id: "p1", amount: "10.00", platformFee: "0.50" }])
            : [],
        ),
      create,
      insertLine,
    });
    const svc = new PayoutService(repo);
    const r = await svc.runBulkSettlementWithTransfers(null, { initiateTransfer });
    expect(r.settlement.createdCount).toBe(10);
    expect(initiateTransfer).toHaveBeenCalledTimes(10);
    expect(r.transfers.items.filter((i) => i.outcome === "transfer_failed")).toHaveLength(1);
    expect(r.transfers.items.filter((i) => i.outcome === "transfer_initiated")).toHaveLength(9);
    expect(r.transfers.summary.byOutcome.transfer_failed).toBe(1);
    expect(r.transfers.summary.byOutcome.transfer_initiated).toBe(9);
  });

  it("skips transfer when settlement creation throws; other entities still process", async () => {
    const e1 = entityId(1);
    const e2 = entityId(2);
    const e3 = entityId(3);
    const e4 = entityId(4);
    const create = vi.fn().mockImplementation(async (input: { legalEntityId: string }) => {
      if (input.legalEntityId === e3) {
        throw new Error("db connection reset");
      }
      return payout({
        id: `po-${input.legalEntityId.slice(-2)}`,
        legalEntityId: input.legalEntityId,
      });
    });
    const insertLine = vi.fn().mockImplementation(async (input: { payoutId: string }) => ({
      id: `line-${input.payoutId}`,
      payoutId: input.payoutId,
      paymentId: "pay-1",
      amount: "10.00",
      kind: "sale" as const,
      createdByUserId: null,
      note: null,
      createdAt: new Date(),
    }));
    const initiateTransfer = vi.fn().mockResolvedValue({ ok: true, stripeTransferId: "tr_ok" });
    const repo = makeRepo({
      listLegalEntityIdsWithUnlinkedCapturedPayments: vi.fn().mockResolvedValue([e1, e2, e3, e4]),
      listScheduledPayoutsAwaitingTransfer: vi.fn().mockResolvedValue([]),
      findUnlinkedCapturedPayments: vi
        .fn()
        .mockResolvedValue(pending([{ id: "p1", amount: "10.00", platformFee: "0.50" }])),
      create,
      insertLine,
    });
    const svc = new PayoutService(repo);
    const r = await svc.runBulkSettlementWithTransfers(null, { initiateTransfer });
    expect(initiateTransfer).toHaveBeenCalledTimes(3);
    expect(r.settlement.items.filter((i) => i.outcome === "error")).toHaveLength(1);
    expect(r.transfers.items.filter((i) => i.outcome === "settlement_db_error")).toHaveLength(1);
  });

  it("second cron run retries initiateTransfer for a scheduled payout left after failure", async () => {
    const e5 = entityId(5);
    const po5 = payout({ id: "po-resume-5", legalEntityId: e5, status: "scheduled" });
    const listUnlinked = vi.fn().mockResolvedValueOnce([e5]).mockResolvedValueOnce([]);
    const listResume = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([po5]);
    let transferRound = 0;
    const initiateTransfer = vi.fn(async (payoutId: string): Promise<InitiateTransferResult> => {
      if (payoutId !== "po-resume-5") {
        return { ok: true, stripeTransferId: "tr_other" };
      }
      transferRound++;
      if (transferRound === 1) {
        return {
          ok: false,
          reason: "stripe_error",
          stripeErrorCode: "x",
          stripeErrorMessage: "retry",
        };
      }
      return { ok: true, stripeTransferId: "tr_final" };
    });
    const create = vi
      .fn()
      .mockImplementation(async (input: { legalEntityId: string }) =>
        payout({ id: "po-resume-5", legalEntityId: input.legalEntityId }),
      );
    const insertLine = vi.fn().mockImplementation(async (input: { payoutId: string }) => ({
      id: `line-${input.payoutId}`,
      payoutId: input.payoutId,
      paymentId: "pay-1",
      amount: "10.00",
      kind: "sale" as const,
      createdByUserId: null,
      note: null,
      createdAt: new Date(),
    }));
    const repo = makeRepo({
      listLegalEntityIdsWithUnlinkedCapturedPayments: listUnlinked,
      listScheduledPayoutsAwaitingTransfer: listResume,
      findUnlinkedCapturedPayments: vi
        .fn()
        .mockResolvedValue(pending([{ id: "p1", amount: "10.00", platformFee: "0.50" }])),
      create,
      insertLine,
    });
    const svc = new PayoutService(repo);
    await svc.runBulkSettlementWithTransfers(null, { initiateTransfer });
    await svc.runBulkSettlementWithTransfers(null, { initiateTransfer });
    expect(initiateTransfer.mock.calls.filter((c) => c[0] === "po-resume-5")).toHaveLength(2);
  });
});
