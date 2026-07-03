import type { Job } from "bullmq";
import type pino from "pino";
import type { WorkerEnv } from "../env.js";
import type { UploadStorage } from "../lib/upload-storage.js";
import type { IPayoutStatementRepository } from "../repositories/interfaces/payout-statement.repository.js";
import { payoutStatementObjectKey, renderPayoutStatementPdf } from "./payout-statement.renderer.js";

export type GeneratePayoutStatementJobData = {
  payoutId: string;
};

export async function generatePayoutStatementJob(options: {
  payoutStatementRepo: IPayoutStatementRepository;
  storage: UploadStorage;
  env: WorkerEnv;
  log: pino.Logger;
  job: Job<GeneratePayoutStatementJobData>;
}): Promise<void> {
  const { payoutStatementRepo, storage, env, log, job } = options;
  const { payoutId } = job.data;
  const maxAttempts = typeof job.opts.attempts === "number" ? job.opts.attempts : 3;

  try {
    const pRow = await payoutStatementRepo.findPayoutById(payoutId);
    if (!pRow) {
      throw new Error("payout_not_found");
    }

    const entityRow = await payoutStatementRepo.findLegalEntityById(pRow.legalEntityId);
    if (!entityRow) {
      throw new Error("legal_entity_not_found");
    }

    const lines = await payoutStatementRepo.findPayoutLines(payoutId);
    const authorIds = [
      ...new Set(
        lines.map((l) => l.createdByUserId).filter((id): id is string => typeof id === "string"),
      ),
    ];
    const authorMap = await payoutStatementRepo.findAuthorNames(authorIds);

    const pdf = await renderPayoutStatementPdf({
      payout: pRow,
      entity: entityRow,
      lines,
      authorNames: authorMap,
      env,
    });

    const key = payoutStatementObjectKey(pRow.legalEntityId, payoutId);
    const { url } = await storage.putObject(key, pdf, "application/pdf");

    await payoutStatementRepo.markStatementGenerated(payoutId, url);

    log.info({ payoutId, key }, "payout_statement_generated");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const attemptNo = (job.attemptsMade ?? 0) + 1;
    log.error(
      { err: message, payoutId, attempt: attemptNo, maxAttempts },
      "payout_statement_generation_failed",
    );
    if (attemptNo >= maxAttempts) {
      await payoutStatementRepo.markStatementError(payoutId, message);
    }
    throw err;
  }
}
