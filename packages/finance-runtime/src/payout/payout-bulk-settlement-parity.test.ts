import { describe, expect, it, vi } from "vitest";
import {
  entityId,
  makeSettlementRepo,
  payoutRow,
  pending,
  runBulkSettlementParity,
  settlementDeps,
  snapshotBulkResult,
} from "./payout-bulk-settlement-parity.helpers.js";
import type { InitiateTransferResult } from "./types.js";

describe("bulk settlement parity (shared finance-runtime)", () => {
  it("no-op when no eligible legal entities", async () => {
    const repo = makeSettlementRepo({
      listLegalEntityIdsWithUnlinkedCapturedPayments: vi.fn().mockResolvedValue([]),
      listScheduledPayoutsAwaitingTransfer: vi.fn().mockResolvedValue([]),
    });
    const initiateTransfer = vi.fn();
    const r = await runBulkSettlementParity(settlementDeps(repo), initiateTransfer);
    expect(r.settlement.eligibleEntityCount).toBe(0);
    expect(r.settlement.createdCount).toBe(0);
    expect(initiateTransfer).not.toHaveBeenCalled();
  });

  it("skips entity with no pending payments", async () => {
    const e1 = entityId(1);
    const repo = makeSettlementRepo({
      listLegalEntityIdsWithUnlinkedCapturedPayments: vi.fn().mockResolvedValue([e1]),
      findUnlinkedCapturedPayments: vi.fn().mockResolvedValue([]),
      listScheduledPayoutsAwaitingTransfer: vi.fn().mockResolvedValue([]),
    });
    const r = await runBulkSettlementParity(settlementDeps(repo), vi.fn());
    expect(snapshotBulkResult(r).settlementOutcomes).toEqual([
      { legalEntityId: e1, outcome: "skipped", reason: "no_pending_payments", payoutId: undefined },
    ]);
  });

  it("maps connect_not_ready on transfer", async () => {
    const e1 = entityId(1);
    const create = vi.fn().mockResolvedValue(payoutRow({ id: "po-cnr", legalEntityId: e1 }));
    const insertLine = vi.fn().mockResolvedValue({
      id: "line-1",
      payoutId: "po-cnr",
      paymentId: "p1",
      amount: "10.00",
      kind: "sale" as const,
      createdByUserId: null,
      note: null,
      createdAt: new Date(),
    });
    const repo = makeSettlementRepo({
      listLegalEntityIdsWithUnlinkedCapturedPayments: vi.fn().mockResolvedValue([e1]),
      findUnlinkedCapturedPayments: vi.fn().mockResolvedValue(pending([{}])),
      listScheduledPayoutsAwaitingTransfer: vi.fn().mockResolvedValue([]),
      create,
      insertLine,
    });
    const initiateTransfer = vi.fn().mockResolvedValue({
      ok: false,
      reason: "connect_not_ready",
    } satisfies InitiateTransferResult);
    const r = await runBulkSettlementParity(settlementDeps(repo), initiateTransfer);
    expect(r.transfers.items[0]?.outcome).toBe("connect_not_ready");
  });

  it("continues after stripe_error on one entity", async () => {
    const entities = Array.from({ length: 3 }, (_, idx) => entityId(idx + 1));
    let transferCalls = 0;
    const initiateTransfer = vi.fn(async (): Promise<InitiateTransferResult> => {
      transferCalls++;
      if (transferCalls === 2) {
        return {
          ok: false,
          reason: "stripe_error",
          stripeErrorCode: "rate_limit",
          stripeErrorMessage: "slow down",
        };
      }
      return { ok: true, stripeTransferId: `tr_${transferCalls}` };
    });
    const create = vi.fn().mockImplementation(async (input: { legalEntityId: string }) =>
      payoutRow({
        id: `po-${input.legalEntityId.slice(-4)}`,
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
    const repo = makeSettlementRepo({
      listLegalEntityIdsWithUnlinkedCapturedPayments: vi.fn().mockResolvedValue(entities),
      listScheduledPayoutsAwaitingTransfer: vi.fn().mockResolvedValue([]),
      findUnlinkedCapturedPayments: vi.fn().mockResolvedValue(pending([{}])),
      create,
      insertLine,
    });
    const r = await runBulkSettlementParity(settlementDeps(repo), initiateTransfer);
    expect(r.settlement.createdCount).toBe(3);
    expect(r.transfers.summary.byOutcome.transfer_failed).toBe(1);
    expect(r.transfers.summary.byOutcome.transfer_initiated).toBe(2);
  });

  it("second run retries scheduled payout resume without duplicate settlement create", async () => {
    const e5 = entityId(5);
    const po5 = payoutRow({ id: "po-resume-5", legalEntityId: e5, status: "scheduled" });
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
        payoutRow({ id: "po-resume-5", legalEntityId: input.legalEntityId }),
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
    const repo = makeSettlementRepo({
      listLegalEntityIdsWithUnlinkedCapturedPayments: listUnlinked,
      listScheduledPayoutsAwaitingTransfer: listResume,
      findUnlinkedCapturedPayments: vi.fn().mockResolvedValue(pending([{}])),
      create,
      insertLine,
    });
    const deps = settlementDeps(repo);
    await runBulkSettlementParity(deps, initiateTransfer);
    await runBulkSettlementParity(deps, initiateTransfer);
    expect(initiateTransfer.mock.calls.filter((c) => c[0] === "po-resume-5")).toHaveLength(2);
    expect(create.mock.calls.filter((c) => c[0]?.legalEntityId === e5)).toHaveLength(1);
  });
});
