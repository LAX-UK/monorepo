import type { IPayoutRepository } from "@auction/persistence/interfaces";
import type { Queue } from "bullmq";

export async function ensureStatementQueued(
  payoutRepo: IPayoutRepository,
  queue: Queue<{ payoutId: string }>,
  payoutId: string,
): Promise<void> {
  await payoutRepo.clearStatementGenerationError(payoutId);
  await queue.add(
    "generate-payout-statement",
    { payoutId },
    {
      jobId: `payout-statement:${payoutId}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 4000 },
      removeOnComplete: 50,
    },
  );
}
