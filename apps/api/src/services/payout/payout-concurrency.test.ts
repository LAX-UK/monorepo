import type { IPayoutRepository } from "@auction/persistence/interfaces";
import type { Payout, PayoutLine } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import { PayoutNotFoundError, PayoutStatusTransitionError } from "../interfaces/payout.js";
import { PayoutService } from "../payout.service.js";

const ENTITY_ID = "00000000-0000-4000-8000-000000000001";
const ACTOR_ID = "user-actor";

function basePayout(overrides: Partial<Payout> = {}): Payout {
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

/**
 * In-memory payout repository with the same contract as the Postgres one:
 * reads see committed state, and updateStatusIfCurrent is an atomic compare-and-set.
 * Every method yields first, so concurrent callers interleave their reads.
 */
function makeFakeRepo(initial: Payout) {
  let row = { ...initial };
  const lines: PayoutLine[] = [];
  const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
  const repo = {
    findById: async (id: string) => {
      await tick();
      return id === row.id ? { ...row } : null;
    },
    findByIdForUpdate: async (id: string) => {
      await tick();
      return id === row.id ? { ...row } : null;
    },
    updateStatusIfCurrent: async (
      id: string,
      expected: Payout["status"],
      patch: Partial<Payout> & { status: Payout["status"] },
    ) => {
      await tick();
      if (id !== row.id || row.status !== expected) return null;
      row = { ...row, ...patch };
      return { ...row };
    },
    insertLine: async (input: Omit<PayoutLine, "id" | "createdAt">) => {
      await tick();
      const line = { ...input, id: `line-${lines.length + 1}`, createdAt: new Date() };
      lines.push(line as PayoutLine);
      return line as PayoutLine;
    },
  } as unknown as IPayoutRepository;
  return { repo, lines, current: () => row };
}

function serviceFor(repo: IPayoutRepository) {
  const publish = vi.fn().mockResolvedValue(undefined);
  const svc = new PayoutService(
    repo,
    { runInTransaction: (fn) => fn({} as never) },
    mockDomainEventSink(publish),
    undefined,
    () => repo,
  );
  return { svc, publish };
}

async function settle<T>(promises: Promise<T>[]) {
  const results = await Promise.allSettled(promises);
  return {
    won: results.filter((r) => r.status === "fulfilled"),
    lost: results.filter((r): r is PromiseRejectedResult => r.status === "rejected"),
  };
}

describe("payout status transitions under concurrency", () => {
  it("lets exactly one of two parallel mark-paid calls win and publishes one payout.paid", async () => {
    const { repo, current } = makeFakeRepo(basePayout({ status: "scheduled" }));
    const { svc, publish } = serviceFor(repo);

    const { won, lost } = await settle([
      svc.markPaid(ACTOR_ID, "po1", { stripeTransferId: "tr_a" }),
      svc.markPaid(ACTOR_ID, "po1", { stripeTransferId: "tr_b" }),
    ]);

    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect(lost[0]?.reason).toBeInstanceOf(PayoutStatusTransitionError);
    expect(lost[0]?.reason.code).toBe("payout_already_paid");
    expect(publish.mock.calls.filter((c) => c[0].eventType === "payout.paid")).toHaveLength(1);
    expect(current().status).toBe("paid");
  });

  it("rejects the loser with a state-changed error when mark-paid races a reversal", async () => {
    const { repo, current } = makeFakeRepo(basePayout({ status: "in_transit" }));
    const { svc, publish } = serviceFor(repo);

    const { won, lost } = await settle([
      svc.markPaid(ACTOR_ID, "po1", { stripeTransferId: "tr_a" }),
      svc.adminManualReverse(ACTOR_ID, "po1", { reason: "bank returned the transfer" }),
    ]);

    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect(lost[0]?.reason).toBeInstanceOf(PayoutStatusTransitionError);
    expect(lost[0]?.reason.code).toBe("payout_state_changed");
    expect(publish).toHaveBeenCalledTimes(1);
    expect(["paid", "reversed"]).toContain(current().status);
  });

  it("lets exactly one of two parallel reversals win, with one reversal line and one event", async () => {
    const { repo, lines, current } = makeFakeRepo(basePayout({ status: "paid" }));
    const { svc, publish } = serviceFor(repo);

    const { won, lost } = await settle([
      svc.adminManualReverse(ACTOR_ID, "po1", { reason: "duplicate transfer sent" }),
      svc.adminManualReverse(ACTOR_ID, "po1", { reason: "duplicate transfer sent" }),
    ]);

    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect(lost[0]?.reason).toBeInstanceOf(PayoutStatusTransitionError);
    expect(lines).toHaveLength(1);
    expect(publish.mock.calls.filter((c) => c[0].eventType === "payout.reversed")).toHaveLength(1);
    expect(current().status).toBe("reversed");
  });

  it("reports payout_already_paid when mark-paid is repeated after the first call finished", async () => {
    const { repo } = makeFakeRepo(basePayout({ status: "scheduled" }));
    const { svc } = serviceFor(repo);
    await svc.markPaid(ACTOR_ID, "po1", { stripeTransferId: "tr_a" });
    await expect(svc.markPaid(ACTOR_ID, "po1", { stripeTransferId: "tr_a" })).rejects.toMatchObject(
      { code: "payout_already_paid" },
    );
  });

  it("answers not found for an unknown payout", async () => {
    const { repo } = makeFakeRepo(basePayout());
    const { svc } = serviceFor(repo);
    await expect(
      svc.markPaid(ACTOR_ID, "missing", { stripeTransferId: "tr_a" }),
    ).rejects.toBeInstanceOf(PayoutNotFoundError);
  });

  it("refuses to run a transition without a transaction runner", async () => {
    const { repo } = makeFakeRepo(basePayout());
    const svc = new PayoutService(repo);
    await expect(svc.markPaid(ACTOR_ID, "po1", { stripeTransferId: "tr_a" })).rejects.toThrow(
      "payout_transactions_not_configured",
    );
    await expect(svc.adminManualReverse(ACTOR_ID, "po1", { reason: "no runner" })).rejects.toThrow(
      "payout_transactions_not_configured",
    );
  });
});
