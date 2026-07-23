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
import { runBulkSettlementWithTransfers } from "./payout-bulk-transfer.js";
import type { PayoutServiceDeps } from "./payout-helpers.js";

describe("API payout bulk settlement parity (finance-runtime bridge)", () => {
  it("API wrapper returns same snapshot as direct shared harness", async () => {
    const e1 = entityId(1);
    const create = vi.fn().mockResolvedValue(payoutRow({ id: "po-api", legalEntityId: e1 }));
    const insertLine = vi.fn().mockResolvedValue({
      id: "line-1",
      payoutId: "po-api",
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
    const initiateTransfer = vi.fn().mockResolvedValue({ ok: true, stripeTransferId: "tr_api" });
    const deps: PayoutServiceDeps = {
      repo,
      transactionRunner: null,
      domainEventSink: undefined,
      payoutAdjustments: undefined,
      payoutRepoForTx: () => repo,
    };
    const [direct, viaApi] = [
      await runBulkSettlementParity(settlementDeps(repo), initiateTransfer),
      await runBulkSettlementWithTransfers(deps, null, { initiateTransfer }),
    ];
    expect(snapshotBulkResult(direct)).toEqual(snapshotBulkResult(viaApi));
  });
});
