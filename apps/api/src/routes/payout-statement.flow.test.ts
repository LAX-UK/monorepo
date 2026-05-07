import type { Queue } from "bullmq";
import { describe, expect, it, vi } from "vitest";
import { ensureStatementQueued } from "./payout-statements.js";
import type { IPayoutRepository } from "../services/interfaces/payout-repository.js";

describe("payout statement queue ", () => {
  it("first request clears error bit and enqueues idempotent job", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const queue = { add } as unknown as Queue<{ payoutId: string }>;
    const repo: Pick<IPayoutRepository, "clearStatementGenerationError"> = {
      clearStatementGenerationError: vi.fn().mockResolvedValue(undefined),
    };
    await ensureStatementQueued(repo as IPayoutRepository, queue, "00000000-0000-4000-8000-000000000099");
    expect(repo.clearStatementGenerationError).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000099",
    );
    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(
      "generate-payout-statement",
      { payoutId: "00000000-0000-4000-8000-000000000099" },
      expect.objectContaining({
        jobId: "payout-statement:00000000-0000-4000-8000-000000000099",
        attempts: 3,
        backoff: { type: "exponential", delay: 4000 },
      }),
    );
  });
});
