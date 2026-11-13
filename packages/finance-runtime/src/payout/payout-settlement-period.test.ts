import { SETTLEMENT_PERIOD_FLOOR } from "@auction/domain";
import type { IPayoutRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import {
  makeSettlementRepo,
  payoutRow,
  pending,
  storedSellerTerms,
} from "./payout-bulk-settlement-parity.helpers.js";
import type { PayoutSettlementDeps } from "./payout-helpers.js";
import { createSettlement, runBulkSettlement } from "./payout-settlement.js";

const ENTITY = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-11-09T10:00:00.000Z");

/** The repository one transaction sees, recording the order things were asked in. */
function setup(over: Partial<IPayoutRepository> = {}) {
  const calls: string[] = [];
  const create = vi.fn(async (input: Parameters<IPayoutRepository["create"]>[0]) =>
    payoutRow({ ...input }),
  );
  const tx = makeSettlementRepo({
    lockSettlementForEntity: async () => {
      calls.push("lock");
    },
    lockPendingPayments: async () => {
      calls.push("lock_payments");
    },
    list: async () => {
      calls.push("period");
      return [];
    },
    findUnlinkedCapturedPayments: async () => pending([{ capturedAt: new Date("2026-10-01") }]),
    create,
    ...over,
  });
  // The repository outside the transaction must not be used to work out the period.
  const root = makeSettlementRepo({
    list: async () => {
      throw new Error("period read outside the transaction");
    },
  });
  const deps: PayoutSettlementDeps = {
    repo: root,
    transactionRunner: { runInTransaction: (fn) => fn({} as never) },
    domainEventSink: { withTx: () => ({ publish: async () => undefined }) },
    payoutAdjustments: undefined,
    payoutRepoForTx: () => tx,
    sellerTermsForTx: () => storedSellerTerms(),
  };
  return { deps, calls, create };
}

describe("settlement period", () => {
  it("is worked out after the entity is locked, through the transaction's own repository", async () => {
    const { deps, calls, create } = setup();
    const result = await createSettlement(deps, null, { legalEntityId: ENTITY, periodEnd: NOW });
    expect(result.ok).toBe(true);
    expect(calls).toEqual(["lock", "lock_payments", "period"]);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ periodStart: new Date("2026-10-01"), periodEnd: NOW }),
    );
  });

  it("continues where the last settled period ended, so a run that waited cannot overlap it", async () => {
    const previousEnd = new Date("2026-11-01T00:00:00.000Z");
    const { deps, create } = setup({
      list: async () => [payoutRow({ periodEnd: previousEnd })],
    });
    await createSettlement(deps, "staff-1", { legalEntityId: ENTITY, periodEnd: NOW });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ periodStart: previousEnd, periodEnd: NOW }),
    );
  });

  it("starts a first run at the oldest waiting payment, never before the floor", async () => {
    const { deps, create } = setup({
      findUnlinkedCapturedPayments: async () => pending([{ capturedAt: new Date("1999-01-01") }]),
    });
    await createSettlement(deps, null, { legalEntityId: ENTITY, periodEnd: NOW });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ periodStart: SETTLEMENT_PERIOD_FLOOR }),
    );
  });

  it("refuses a requested start inside a period already settled, and writes nothing", async () => {
    const { deps, create } = setup({
      list: async () => [payoutRow({ periodEnd: new Date("2026-11-01") })],
    });
    const result = await createSettlement(deps, "staff-1", {
      legalEntityId: ENTITY,
      periodStart: new Date("2026-10-15"),
      periodEnd: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "settlement_period_overlaps" });
    expect(create).not.toHaveBeenCalled();
  });

  it("gives the cron the same rule: no run starts at the epoch any more", async () => {
    const lastEnd = new Date("2026-11-05T00:00:00.000Z");
    const { deps, create } = setup({
      list: async () => [payoutRow({ periodEnd: lastEnd })],
      listLegalEntityIdsWithUnlinkedCapturedPayments: async () => [ENTITY],
    });
    const root = deps.repo;
    const withEntities: PayoutSettlementDeps = {
      ...deps,
      repo: Object.assign(Object.create(root), {
        listLegalEntityIdsWithUnlinkedCapturedPayments: async () => [ENTITY],
      }),
    };
    const result = await runBulkSettlement(withEntities, null, { periodEnd: NOW });
    expect(result.createdCount).toBe(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ periodStart: lastEnd, periodEnd: NOW }),
    );
  });
});
