import type {
  ISourceOfFundsRepository,
  ITransactionRunner,
  SourceOfFundsCase,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import {
  SOURCE_OF_FUNDS_REQUIRED_EVENT,
  SourceOfFundsGateService,
} from "./source-of-funds-gate.service.js";

function makeCase(userId: string): SourceOfFundsCase {
  return {
    id: "sof_1",
    userId,
    status: "pending",
    trigger: "threshold",
    thresholdAmount: "9000.00",
    exposureAmount: "9500.00",
    currency: "GBP",
  } as SourceOfFundsCase;
}

describe("SourceOfFundsGateService.requiresSourceOfFunds", () => {
  it("opens one case and publishes one event for two concurrent calls", async () => {
    let pending: SourceOfFundsCase | null = null;
    // Mirrors the DB: both callers read "no case", the first insert wins, the second is a no-op.
    const repo = {
      sumActiveBuyerSettlementPence: async () => 0,
      findLatestApprovedForUser: async () => null,
      findLatestForUser: async () => null,
      findPendingForUser: vi.fn(async () => null),
      create: vi.fn(async (input: { userId: string }) => {
        await Promise.resolve();
        if (pending) return { case: pending, created: false };
        pending = makeCase(input.userId);
        return { case: pending, created: true };
      }),
    } as unknown as ISourceOfFundsRepository;
    const publish = vi.fn(async () => {});
    const events = { withTx: () => ({ publish }) };
    const runner = {
      runInTransaction: async (fn: (tx: never) => Promise<unknown>) => fn({} as never),
    } as unknown as ITransactionRunner;
    const gate = new SourceOfFundsGateService(
      repo,
      { thresholdAmount: 9000, currency: "GBP", approvalValidityDays: 365 },
      runner,
      events,
    );

    const input = { buyerUserId: "u1", amountPence: 950_000 };
    const results = await Promise.all([
      gate.requiresSourceOfFunds(input),
      gate.requiresSourceOfFunds(input),
    ]);

    expect(results).toEqual([true, true]);
    expect(repo.create).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: SOURCE_OF_FUNDS_REQUIRED_EVENT, aggregateId: "sof_1" }),
    );
  });
});
