import { DrizzleEmailOutboxRepository } from "../repositories/drizzle-email-outbox.repository.js";
import { DrizzlePayoutStatementRepository } from "../repositories/drizzle-payout-statement.repository.js";
import { DrizzleUploadValidationRepository } from "../repositories/drizzle-upload-validation.repository.js";
import type { IEmailOutboxRepository } from "../repositories/interfaces/email-outbox.repository.js";
import type { IPayoutStatementRepository } from "../repositories/interfaces/payout-statement.repository.js";
import type { IUploadValidationRepository } from "../repositories/interfaces/upload-validation.repository.js";
import type { WorkerDb } from "../workers/types.js";

export type WorkerRepositories = {
  uploadValidationRepo: IUploadValidationRepository;
  emailOutboxRepo: IEmailOutboxRepository;
  payoutStatementRepo: IPayoutStatementRepository;
};

export function createWorkerRepositories(db: WorkerDb): WorkerRepositories {
  return {
    uploadValidationRepo: new DrizzleUploadValidationRepository(db),
    emailOutboxRepo: new DrizzleEmailOutboxRepository(db),
    payoutStatementRepo: new DrizzlePayoutStatementRepository(db),
  };
}
