import type { IPayoutRepository } from "@auction/persistence/interfaces";
import type { PayoutLine } from "@auction/types";
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

const saleLine = (i: { payoutId: string; paymentId: string; amount: string }): PayoutLine => ({
  id: `line-${i.paymentId}`,
  payoutId: i.payoutId,
  paymentId: i.paymentId,
  privateSaleDealId: null,
  amount: i.amount,
  kind: "sale",
  createdByUserId: null,
  note: null,
  createdAt: new Date(),
});

/** A transaction runner that records whether each transaction committed or rolled back. */
function setup(over: Partial<IPayoutRepository> = {}) {
  const outcomes: ("committed" | "rolled_back")[] = [];
  const published: string[] = [];
  const create = vi.fn(async (input: Parameters<IPayoutRepository["create"]>[0]) =>
    payoutRow({ ...input }),
  );
  const tx = makeSettlementRepo({
    lockPendingPayments: async () => ["p1", "p2"],
    findUnlinkedCapturedPayments: async () => pending([{ id: "p1" }, { id: "p2" }]),
    listLegalEntityIdsWithUnlinkedCapturedPayments: async () => [ENTITY],
    create,
    ...over,
  });
  const deps: PayoutSettlementDeps = {
    repo: tx,
    transactionRunner: {
      runInTransaction: async (fn) => {
        try {
          const result = await fn({} as never);
          outcomes.push("committed");
          return result;
        } catch (err) {
          outcomes.push("rolled_back");
          throw err;
        }
      },
    },
    domainEventSink: {
      withTx: () => ({
        publish: async (event) => {
          published.push(event.eventType);
        },
      }),
    },
    payoutAdjustments: undefined,
    payoutRepoForTx: () => tx,
    sellerTermsForTx: () => storedSellerTerms(),
  };
  return { deps, outcomes, published, create };
}

describe("a refused confirmed run rolls its transaction back", () => {
  it("figures that no longer match: rolled back, answered figures_changed, nothing created", async () => {
    const { deps, outcomes, published, create } = setup();
    const result = await createSettlement(deps, "staff-1", {
      legalEntityId: ENTITY,
      periodEnd: NOW,
      confirmed: { netPence: 1, paymentIds: ["p1"], dealIds: [] },
    });
    expect(result).toMatchObject({ ok: false, reason: "figures_changed" });
    expect(outcomes).toEqual(["rolled_back"]);
    expect(create).not.toHaveBeenCalled();
    expect(published).toEqual([]);
  });

  it("a sale line skipped after the check: rolled back, answered figures_changed", async () => {
    const {
      deps: again,
      outcomes: o2,
      published: p2,
    } = setup({
      tryInsertSaleLine: async (i) => (i.paymentId === "p2" ? null : saleLine(i)),
    });
    // Confirm exactly what a full run would pay, then have p2 taken by another run first.
    const { deps: full } = setup();
    const confirmedFrom = await createSettlement(full, "staff-1", {
      legalEntityId: ENTITY,
      periodEnd: NOW,
    });
    if (!confirmedFrom.ok) throw new Error("expected a payout");
    const result = await createSettlement(again, "staff-1", {
      legalEntityId: ENTITY,
      periodEnd: NOW,
      confirmed: {
        netPence: Math.round(Number(confirmedFrom.payout.netAmount) * 100),
        paymentIds: ["p1", "p2"],
        dealIds: [],
      },
    });
    expect(result).toMatchObject({ ok: false, reason: "figures_changed" });
    expect(o2).toEqual(["rolled_back"]);
    expect(p2).toEqual([]);
  });

  it("other errors are not swallowed", async () => {
    const { deps, outcomes } = setup({
      create: async () => {
        throw new Error("boom");
      },
    });
    await expect(
      createSettlement(deps, "staff-1", { legalEntityId: ENTITY, periodEnd: NOW }),
    ).rejects.toThrow("boom");
    expect(outcomes).toEqual(["rolled_back"]);
  });
});

describe("the nightly bulk run (no confirmed figures) is unchanged", () => {
  it("pays what is waiting and commits", async () => {
    const { deps, outcomes, published } = setup();
    const result = await runBulkSettlement(deps, null, { periodEnd: NOW });
    expect(result).toMatchObject({ eligibleEntityCount: 1, createdCount: 1 });
    expect(result.items[0]).toMatchObject({ legalEntityId: ENTITY, outcome: "created" });
    expect(outcomes).toEqual(["committed"]);
    expect(published).toEqual(["payout.settlement_created"]);
  });

  it("still pays the rest when a sale line is skipped, rather than refusing", async () => {
    const updateTotals = vi.fn(async () => undefined);
    const { deps, outcomes } = setup({
      tryInsertSaleLine: async (i) => (i.paymentId === "p2" ? null : saleLine(i)),
      updateTotals,
    });
    const result = await runBulkSettlement(deps, null, { periodEnd: NOW });
    expect(result).toMatchObject({ createdCount: 1 });
    expect(outcomes).toEqual(["committed"]);
    expect(updateTotals).toHaveBeenCalledTimes(1);
  });
});
