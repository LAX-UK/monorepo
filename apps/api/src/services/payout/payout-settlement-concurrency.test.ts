import type { Database } from "@auction/db";
import type { IPayoutRepository } from "@auction/persistence/interfaces";
import type { Payout, PayoutLine } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import { PayoutService } from "../payout.service.js";

const ENTITY_ID = "00000000-0000-4000-8000-000000000001";
const ACTOR_ID = "user-actor";

function payoutRow(id: string): Payout {
  return {
    id,
    legalEntityId: ENTITY_ID,
    periodStart: new Date("2026-01-01"),
    periodEnd: new Date("2026-01-31"),
    grossAmount: "200.00",
    platformFee: "10.00",
    stripeFee: "0.00",
    netAmount: "190.00",
    currency: "GBP",
    status: "scheduled",
    stripeTransferId: null,
    xeroBillId: null,
    failureReason: null,
    processedAt: null,
    statementUrl: null,
    statementGenerationError: null,
    createdAt: new Date("2026-02-01"),
  };
}

/** Fake repo plus a runner whose transactions hold the per-entity lock until they end. */
function makeFixture() {
  const settledPaymentIds = new Set<string>();
  const payouts: Payout[] = [];
  const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
  let held: Promise<void> = Promise.resolve();
  const releases = new WeakMap<object, () => void>();

  const repo = {
    findUnlinkedCapturedPayments: async () => {
      await tick();
      return ["pay-1", "pay-2"]
        .filter((id) => !settledPaymentIds.has(id))
        .map((id) => ({
          id,
          amount: "100.00",
          platformFee: "5.00",
          capturedAt: new Date("2026-01-01"),
          settlementAmount: "100.00",
        }));
    },
    create: async () => {
      await tick();
      const created = payoutRow(`po-${payouts.length + 1}`);
      payouts.push(created);
      return created;
    },
    tryInsertSaleLine: async (input: { paymentId: string; payoutId: string; amount: string }) => {
      await tick();
      if (settledPaymentIds.has(input.paymentId)) return null;
      settledPaymentIds.add(input.paymentId);
      return { ...input, id: `l-${input.paymentId}`, kind: "sale" } as unknown as PayoutLine;
    },
  } as unknown as IPayoutRepository;

  const repoForTx = (tx: Database): IPayoutRepository =>
    ({
      ...repo,
      lockSettlementForEntity: async () => {
        const previous = held;
        held = new Promise<void>((resolve) => releases.set(tx, resolve));
        await previous;
      },
    }) as IPayoutRepository;

  const publish = vi.fn().mockResolvedValue(undefined);
  const svc = new PayoutService(
    repo,
    {
      runInTransaction: async (fn) => {
        const tx = {} as Database;
        try {
          return await fn(tx as never);
        } finally {
          releases.get(tx)?.();
        }
      },
    },
    mockDomainEventSink(publish),
    undefined,
    repoForTx,
  );
  return { svc, payouts, publish };
}

describe("settlement under concurrency", () => {
  const input = {
    legalEntityId: ENTITY_ID,
    periodStart: new Date(0),
    periodEnd: new Date("2026-02-01"),
  };

  it("creates one payout when two runs for the same entity overlap", async () => {
    const { svc, payouts, publish } = makeFixture();

    const results = await Promise.all([
      svc.createSettlement(ACTOR_ID, input),
      svc.createSettlement(null, input),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, reason: "no_pending_payments" }]);
    expect(payouts).toHaveLength(1);
    const created = publish.mock.calls.filter(
      (c) => c[0].eventType === "payout.settlement_created",
    );
    expect(created).toHaveLength(1);
  });

  it("refuses to create a settlement without a transaction runner", async () => {
    const svc = new PayoutService({} as IPayoutRepository);
    await expect(svc.createSettlement(ACTOR_ID, input)).rejects.toThrow(
      "payout_transactions_not_configured",
    );
  });
});
