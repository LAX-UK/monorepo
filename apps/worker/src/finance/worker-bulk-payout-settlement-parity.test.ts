import {
  entityId,
  makeSettlementRepo,
  payoutRow,
  pending,
  runBulkSettlementParity,
  settlementDeps,
  snapshotBulkResult,
} from "@auction/finance-runtime";
import { describe, expect, it, vi } from "vitest";
import { runWorkerBulkPayoutSettlement } from "./worker-bulk-payout-settlement.js";

describe("worker bulk settlement parity entry", () => {
  it("delegates to shared runtime with same bulk outcome shape as parity harness", async () => {
    const e1 = entityId(1);
    const bulk = {
      settlement: {
        eligibleEntityCount: 1,
        createdCount: 1,
        items: [{ legalEntityId: e1, outcome: "created" as const, payoutId: "po-1" }],
      },
      transfers: {
        items: [
          {
            legalEntityId: e1,
            payoutId: "po-1",
            outcome: "transfer_initiated" as const,
            resume: false,
            stripeTransferId: "tr_1",
          },
        ],
        summary: { totalTransferAttempts: 1, byOutcome: { transfer_initiated: 1 } },
      },
    };
    const runBulkSettlementWithTransfers = vi.fn().mockResolvedValue(bulk);
    const redis = {
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
    };
    const result = await runWorkerBulkPayoutSettlement({
      env: { DISABLE_PAYOUT_SETTLEMENT: false, STRIPE_SECRET_KEY: "sk" } as never,
      redis: redis as never,
      log: { child: () => ({ info: vi.fn() }) } as never,
      settlement: { runtime: { runBulkSettlementWithTransfers } } as never,
    });
    expect(result).toEqual(bulk);
    expect(snapshotBulkResult(result as typeof bulk)).toMatchObject({
      createdCount: 1,
      transferSummary: { transfer_initiated: 1 },
    });
  });

  it("shared harness produces settlement + transfer for one entity", async () => {
    const e1 = entityId(1);
    const create = vi.fn().mockResolvedValue(payoutRow({ id: "po-w", legalEntityId: e1 }));
    const insertLine = vi.fn().mockResolvedValue({
      id: "line-1",
      payoutId: "po-w",
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
    const initiateTransfer = vi.fn().mockResolvedValue({ ok: true, stripeTransferId: "tr_w" });
    const shared = await runBulkSettlementParity(settlementDeps(repo), initiateTransfer);
    expect(shared.settlement.createdCount).toBe(1);
    expect(initiateTransfer).toHaveBeenCalled();
  });
});
