import type { ITransactionRunner } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { purgeEmailSnapshots } from "./purge-email-snapshots.js";

const log = { info: vi.fn(), warn: vi.fn() };

/** A runner whose transactions each clear the next number of rows in `batches`. */
function runnerClearing(batches: number[]) {
  const answers = [...batches];
  const chain: Record<string, unknown> = {};
  for (const method of ["set", "where", "select", "from", "orderBy", "limit", "for"]) {
    chain[method] = () => chain;
  }
  chain.returning = async () => Array.from({ length: answers.shift() ?? 0 }, (_, i) => ({ id: i }));
  const tx = { update: () => chain, select: () => chain };
  const runInTransaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx));
  return { runner: { runInTransaction } as unknown as ITransactionRunner, runInTransaction };
}

describe("purgeEmailSnapshots", () => {
  it("clears nothing and stops after one batch when nothing is due", async () => {
    const { runner, runInTransaction } = runnerClearing([0]);
    expect(await purgeEmailSnapshots({ transactionRunner: runner, log })).toEqual({
      cleared: 0,
      batches: 1,
    });
    expect(runInTransaction).toHaveBeenCalledTimes(1);
  });

  it("keeps taking batches while they come back full, and stops at the first short one", async () => {
    const { runner } = runnerClearing([3, 3, 1]);
    expect(await purgeEmailSnapshots({ transactionRunner: runner, log, batchSize: 3 })).toEqual({
      cleared: 7,
      batches: 3,
    });
  });

  it("stops at the batch limit and says so, leaving the rest to the next run", async () => {
    const { runner, runInTransaction } = runnerClearing(Array.from({ length: 300 }, () => 1));
    const result = await purgeEmailSnapshots({ transactionRunner: runner, log, batchSize: 1 });
    expect(result.batches).toBe(200);
    expect(runInTransaction).toHaveBeenCalledTimes(200);
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ batches: 200 }),
      "purge-email-snapshots: stopped at the batch limit",
    );
  });
});
