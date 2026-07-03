import type { Queue } from "bullmq";
import type { IEmailOutboxRepository } from "../repositories/interfaces/email-outbox.repository.js";
import { type SendEmailJobData, sendEmailUseCase } from "../services/send-email.use-case.js";

export type { SendEmailJobData };
export { sendEmailUseCase as sendEmailJob };

export async function enqueueStaleEmailOutboxRows({
  outboxRepo,
  queue,
}: {
  outboxRepo: IEmailOutboxRepository;
  queue: Queue<SendEmailJobData | Record<string, never>>;
}): Promise<number> {
  const stale = await outboxRepo.findStalePendingIds();

  for (const row of stale) {
    await queue.add(
      "send-email",
      { outboxId: row.id },
      {
        jobId: row.id,
        attempts: 5,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );
  }

  return stale.length;
}
