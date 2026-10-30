import { PayoutAdjustmentService as SharedPayoutAdjustmentService } from "@auction/finance-runtime";
import type { IPayoutRepository } from "@auction/persistence/interfaces";
import type { Payout, PayoutLine } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import { PayoutService } from "../payout.service.js";
import { bridgePayoutAdjustmentService } from "./finance-payout-bridge.js";

/** An administrator who did not process the payout, so the reversal rule lets them act. */
const REVERSER = { userId: "user-reverser", staffRoles: ["administrator"] } as const;

function paidPayout(): Payout {
  return {
    id: "po1",
    legalEntityId: "00000000-0000-4000-8000-000000000001",
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
    processedAt: new Date("2026-02-01"),
    statementUrl: null,
    statementGenerationError: null,
    createdAt: new Date("2026-02-01"),
  };
}

/** Stateful in-memory payout repository: lines and totals persist between calls. */
function makeRepo(initial: Payout) {
  let row = { ...initial };
  const lines: PayoutLine[] = [
    {
      id: "line-sale",
      payoutId: initial.id,
      paymentId: "payment-1",
      amount: "1000.00",
      kind: "sale",
      createdByUserId: null,
      note: null,
      createdAt: new Date("2026-01-15"),
    },
  ];
  const repo = {
    findById: async () => ({ ...row }),
    findByIdForUpdate: async () => ({ ...row }),
    updateStatusIfCurrent: async (
      _id: string,
      expected: Payout["status"],
      patch: Partial<Payout> & { status: Payout["status"] },
    ) => {
      if (row.status !== expected) return null;
      row = { ...row, ...patch };
      return { ...row };
    },
    insertLine: async (input: Omit<PayoutLine, "id" | "createdAt">) => {
      const line = { ...input, id: `line-${lines.length + 1}`, createdAt: new Date() };
      lines.push(line);
      return line;
    },
    listLines: async () => lines.map((l) => ({ ...l })),
    updateTotals: async (_id: string, totals: Pick<Payout, "grossAmount" | "netAmount">) => {
      row = { ...row, ...totals };
    },
  } as unknown as IPayoutRepository;
  return { repo, lines, current: () => row };
}

function serviceFor(
  repo: IPayoutRepository,
  problemNotifier = { payoutProblem: vi.fn(async () => {}) },
) {
  const runner = { runInTransaction: <T>(fn: (tx: never) => Promise<T>) => fn({} as never) };
  const adjustments = bridgePayoutAdjustmentService(
    new SharedPayoutAdjustmentService(runner, repo, () => repo),
  );
  return new PayoutService(
    repo,
    runner,
    mockDomainEventSink(vi.fn().mockResolvedValue(undefined)),
    adjustments,
    () => repo,
    () => ({ listProcessorUserIds: async () => [] }),
    problemNotifier,
  );
}

describe("manual payout reversal", () => {
  it("records one payment-less reversal line for the whole net amount", async () => {
    const { repo, lines } = makeRepo(paidPayout());

    await serviceFor(repo).adminManualReverse(REVERSER, "po1", { reason: "bank returned it" });

    const reversal = lines.filter((l) => l.kind === "reversal");
    expect(reversal).toEqual([
      expect.objectContaining({
        paymentId: null,
        amount: "-950.00",
        createdByUserId: REVERSER.userId,
        note: "Admin reversal: bank returned it",
      }),
    ]);
  });

  it("leaves nothing owed once the payout is reversed", async () => {
    const { repo, current } = makeRepo(paidPayout());

    const updated = await serviceFor(repo).adminManualReverse(REVERSER, "po1", {
      reason: "bank returned it",
    });

    expect(updated.status).toBe("reversed");
    expect(current().netAmount).toBe("0.00");
    expect(current().platformFee).toBe("50.00");
    expect(current().grossAmount).toBe("50.00");
  });

  it("tells the account once the reversal is recorded", async () => {
    const { repo } = makeRepo(paidPayout());
    const notifier = { payoutProblem: vi.fn(async () => {}) };

    await serviceFor(repo, notifier).adminManualReverse(REVERSER, "po1", {
      reason: "bank returned it",
    });

    expect(notifier.payoutProblem).toHaveBeenCalledWith(
      expect.objectContaining({ id: "po1", status: "reversed" }),
    );
  });
});
