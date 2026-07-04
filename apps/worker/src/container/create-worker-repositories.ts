import type { IMarketingProfileReader } from "@auction/marketing-events";
import type { IComplianceRecipientReader } from "../interfaces/compliance-recipient.reader.js";
import type { IDataExportJobRepository } from "../interfaces/data-export.repository.js";
import type { IEmailOutboxRepository } from "../interfaces/email-outbox.repository.js";
import type { IMarketingContactSyncRepository } from "../interfaces/marketing-contact-sync.repository.js";
import type { IMarketingEventOutboxWorker } from "../interfaces/marketing-event-outbox.worker.js";
import type { INewsletterSignupSyncRepository } from "../interfaces/newsletter-signup-sync.repository.js";
import type { IPayoutStatementRepository } from "../interfaces/payout-statement.repository.js";
import type { ISourceOfFundsDocumentPurgeRepository } from "../interfaces/source-of-funds-document-purge.repository.js";
import type { IStaffOpsRecipientReader } from "../interfaces/staff-ops-recipient.reader.js";
import type { IUploadValidationRepository } from "../interfaces/upload-validation.repository.js";
import { DrizzleProfileMarketingReader } from "../marketing/drizzle-profile.reader.js";
import { DrizzleComplianceRecipientReader } from "../repositories/drizzle-compliance-recipient.reader.js";
import { DrizzleDataExportJobRepository } from "../repositories/drizzle-data-export.repository.js";
import { DrizzleEmailOutboxRepository } from "../repositories/drizzle-email-outbox.repository.js";
import { DrizzleMarketingContactSyncRepository } from "../repositories/drizzle-marketing-contact-sync.repository.js";
import { DrizzleMarketingEventOutboxWorker } from "../repositories/drizzle-marketing-event-outbox.worker.js";
import { DrizzleNewsletterSignupSyncRepository } from "../repositories/drizzle-newsletter-signup-sync.repository.js";
import { DrizzlePayoutStatementRepository } from "../repositories/drizzle-payout-statement.repository.js";
import { DrizzleSourceOfFundsDocumentPurgeRepository } from "../repositories/drizzle-source-of-funds-document-purge.repository.js";
import { DrizzleStaffOpsRecipientReader } from "../repositories/drizzle-staff-ops-recipient.reader.js";
import { DrizzleUploadValidationRepository } from "../repositories/drizzle-upload-validation.repository.js";
import type { WorkerDb } from "../workers/types.js";

export type WorkerRepositories = {
  uploadValidationRepo: IUploadValidationRepository;
  emailOutboxRepo: IEmailOutboxRepository;
  payoutStatementRepo: IPayoutStatementRepository;
  profileMarketingReader: IMarketingProfileReader;
  marketingEventOutboxWorker: IMarketingEventOutboxWorker;
  dataExportRepo: IDataExportJobRepository;
  newsletterSignupSyncRepo: INewsletterSignupSyncRepository;
  sourceOfFundsDocumentPurgeRepo: ISourceOfFundsDocumentPurgeRepository;
  marketingContactSyncRepo: IMarketingContactSyncRepository;
  staffOpsRecipientReader: IStaffOpsRecipientReader;
  complianceRecipientReader: IComplianceRecipientReader;
};

export function createWorkerRepositories(db: WorkerDb): WorkerRepositories {
  return {
    uploadValidationRepo: new DrizzleUploadValidationRepository(db),
    emailOutboxRepo: new DrizzleEmailOutboxRepository(db),
    payoutStatementRepo: new DrizzlePayoutStatementRepository(db),
    profileMarketingReader: new DrizzleProfileMarketingReader(db),
    marketingEventOutboxWorker: new DrizzleMarketingEventOutboxWorker(db),
    dataExportRepo: new DrizzleDataExportJobRepository(db),
    newsletterSignupSyncRepo: new DrizzleNewsletterSignupSyncRepository(db),
    sourceOfFundsDocumentPurgeRepo: new DrizzleSourceOfFundsDocumentPurgeRepository(db),
    marketingContactSyncRepo: new DrizzleMarketingContactSyncRepository(db),
    staffOpsRecipientReader: new DrizzleStaffOpsRecipientReader(db),
    complianceRecipientReader: new DrizzleComplianceRecipientReader(db),
  };
}
