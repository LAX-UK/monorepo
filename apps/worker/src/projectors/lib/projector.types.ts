import type { IEmailService } from "@auction/email";
import type {
  IDomainEventDeliveryRepository,
  INotificationWriteRepository,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import type { IEnsurePersonalLegalEntityService } from "@auction/persistence/lib";
import type pino from "pino";
import type { WorkerEnv } from "../../env.js";
import type { XeroLiveExecutorPorts } from "../../integrations/xero/xero-live-executor.js";
import type { IAdminImpersonationNotifyReader } from "../../interfaces/admin-impersonation-notify.reader.js";
import type { IAdminReviewTaskProjectorRepository } from "../../interfaces/admin-review-task-projector.repository.js";
import type { IClearArtistBlocksRepository } from "../../interfaces/clear-artist-blocks.repository.js";
import type { IComplianceRecipientReader } from "../../interfaces/compliance-recipient.reader.js";
import type { IDomainEventProjectorReader } from "../../interfaces/domain-event-projector.reader.js";
import type { ILotNotifyReader } from "../../interfaces/lot-notify.reader.js";
import type { INotificationFanoutReader } from "../../interfaces/notification-fanout.reader.js";
import type { IPaymentRefundNotifyReader } from "../../interfaces/payment-refund-notify.reader.js";
import type { IPayoutTransferFailedNotifyReader } from "../../interfaces/payout-transfer-failed-notify.reader.js";
import type { IProjectorFailureRecorder } from "../../interfaces/projector-failure-recorder.js";
import type { IProjectorStateRepository } from "../../interfaces/projector-state.repository.js";
import type {
  ISourceOfFundsBuyerReader,
  ISourceOfFundsDocumentsTaskRepository,
  ISourceOfFundsSettlementReader,
} from "../../interfaces/source-of-funds-projector.repository.js";
import type {
  ISourceOfFundsDocumentReviewRepository,
  ISourceOfFundsReviewResolutionRepository,
} from "../../interfaces/source-of-funds-review-projector.repository.js";
import type { IStaffOpsRecipientReader } from "../../interfaces/staff-ops-recipient.reader.js";
import type { Db, ProjectorDbConnection } from "../../interfaces/worker-db.types.js";
import type { ShopIdentityProjectionService } from "../../services/shop-identity-projection.service.js";

export type { Db, ProjectorDbConnection };

export type ProjectorRunContext = {
  projectorStateRepo: IProjectorStateRepository;
  domainEventReader: IDomainEventProjectorReader;
  projectorFailureRecorder: IProjectorFailureRecorder;
  transactionRunner: ITransactionRunner;
  notificationWriteRepo: INotificationWriteRepository;
  adminReviewTaskProjectorRepo: IAdminReviewTaskProjectorRepository;
  notificationFanoutReader: INotificationFanoutReader;
  adminImpersonationNotifyReader: IAdminImpersonationNotifyReader;
  paymentRefundNotifyReader: IPaymentRefundNotifyReader;
  payoutTransferFailedNotifyReader: IPayoutTransferFailedNotifyReader;
  clearArtistBlocksRepo: IClearArtistBlocksRepository;
  ensurePersonalLegalEntity: IEnsurePersonalLegalEntityService;
  sourceOfFundsSettlementReader: ISourceOfFundsSettlementReader;
  sourceOfFundsBuyerReader: ISourceOfFundsBuyerReader;
  sourceOfFundsDocumentsTaskRepo: ISourceOfFundsDocumentsTaskRepository;
  sourceOfFundsDocumentReviewRepo: ISourceOfFundsDocumentReviewRepository;
  sourceOfFundsReviewResolutionRepo: ISourceOfFundsReviewResolutionRepository;
  lotNotifyReader: ILotNotifyReader;
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
  xeroLiveExecutorPorts?: XeroLiveExecutorPorts | undefined;
  env?: WorkerEnv | undefined;
  deliveryRepo?: IDomainEventDeliveryRepository | undefined;
  enqueueMarketingContactSync?:
    | ((data: { userId: string; reason: string; eventId: number }) => Promise<void>)
    | undefined;
  shopIdentityProjection?: ShopIdentityProjectionService | undefined;
};

export interface Projector {
  readonly name: string;
  isEnabled?(ctx: ProjectorRunContext): boolean;
  run(ctx: ProjectorRunContext): Promise<void>;
}
