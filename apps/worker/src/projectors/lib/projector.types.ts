import type { IEmailService } from "@auction/email";
import type { INotificationWriteRepository, ITransactionRunner } from "@auction/persistence/interfaces";
import type pino from "pino";
import type { IAdminReviewTaskProjectorRepository } from "../../interfaces/admin-review-task-projector.repository.js";
import type { IComplianceRecipientReader } from "../../interfaces/compliance-recipient.reader.js";
import type { IStaffOpsRecipientReader } from "../../interfaces/staff-ops-recipient.reader.js";

export type Db = typeof import("@auction/db").createDb extends (url: string) => infer T ? T : never;

export type ProjectorDbConnection = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export type ProjectorRunContext = {
  db: Db;
  transactionRunner: ITransactionRunner;
  notificationWriteRepo: INotificationWriteRepository;
  adminReviewTaskProjectorRepo: IAdminReviewTaskProjectorRepository;
  log: pino.Logger;
  emailService?: IEmailService | undefined;
  supportContactEmail?: string | undefined;
  adminPayoutsUrl?: string | undefined;
  adminEmailAddress?: string | undefined;
  webOrigin?: string | undefined;
  staffOpsRecipientReader: IStaffOpsRecipientReader;
  complianceRecipientReader: IComplianceRecipientReader;
  syncXeroPayoutBill?: ((payoutId: string) => Promise<boolean>) | undefined;
  ensureLotInvoice?: ((lotId: string) => Promise<void>) | undefined;
  enqueueMarketingContactSync?:
    | ((data: { userId: string; reason: string; eventId: number }) => Promise<void>)
    | undefined;
};

export interface Projector {
  readonly name: string;
  isEnabled?(ctx: ProjectorRunContext): boolean;
  run(ctx: ProjectorRunContext): Promise<void>;
}
