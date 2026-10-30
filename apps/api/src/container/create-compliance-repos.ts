import type { Database } from "@auction/db";
import type {
  IAmlHoldStore,
  IEmailObservabilityRepository,
  IEmailSuppressionRepository,
  IEmailWebhookIngestRepository,
  INotificationAccountMuteStore,
  INotificationOutboxRepository,
  INotificationReadRepository,
  INotificationWriteRepository,
  ISourceOfFundsDocumentRepository,
  ISourceOfFundsDocumentReviewRepository,
  ISourceOfFundsRepository,
  ISourceOfFundsSettlementReader,
  IWatchlistScreeningReader,
  IWatchlistScreeningWriter,
  IWebhookEventRepository,
} from "@auction/persistence/interfaces";
import { MuteAwareNotificationWriter } from "@auction/persistence/lib";
import {
  DrizzleAmlHoldStore,
  DrizzleAmlScreeningRepository,
  DrizzleEmailObservabilityRepository,
  DrizzleEmailSuppressionRepository,
  DrizzleEmailWebhookIngestRepository,
  DrizzleNotificationAccountMuteRepository,
  DrizzleNotificationOutboxRepository,
  DrizzleNotificationReadRepository,
  DrizzleNotificationWriteRepository,
  DrizzleSourceOfFundsDocumentRepository,
  DrizzleSourceOfFundsDocumentReviewRepository,
  DrizzleSourceOfFundsRepository,
  DrizzleSourceOfFundsSettlementReader,
  DrizzleWebhookEventRepository,
} from "@auction/persistence/repositories";

export type IAmlScreeningRepository = IWatchlistScreeningReader & IWatchlistScreeningWriter;

export type ComplianceRepositories = {
  notificationReadRepo: INotificationReadRepository;
  notificationWriteRepo: INotificationWriteRepository;
  notificationAccountMuteRepository: INotificationAccountMuteStore;
  notificationOutboxRepository: INotificationOutboxRepository;
  amlScreeningRepository: IAmlScreeningRepository;
  amlHoldStore: IAmlHoldStore;
  sourceOfFundsRepository: ISourceOfFundsRepository;
  sourceOfFundsDocumentRepository: ISourceOfFundsDocumentRepository;
  sourceOfFundsDocumentReviewRepository: ISourceOfFundsDocumentReviewRepository;
  sourceOfFundsSettlementReader: ISourceOfFundsSettlementReader;
  emailObservabilityRepository: IEmailObservabilityRepository;
  emailSuppressionRepository: IEmailSuppressionRepository;
  emailWebhookIngestRepository: IEmailWebhookIngestRepository;
  webhookEventRepository: IWebhookEventRepository;
};

export function createComplianceRepositories(db: Database): ComplianceRepositories {
  const notificationReadRepo = new DrizzleNotificationReadRepository(db);
  const notificationAccountMuteRepository = new DrizzleNotificationAccountMuteRepository(db);
  // Every in-app write skips notifications about an account the recipient has muted.
  const notificationWriteRepo = new MuteAwareNotificationWriter(
    new DrizzleNotificationWriteRepository(db),
    notificationAccountMuteRepository,
  );
  const notificationOutboxRepository = new DrizzleNotificationOutboxRepository(db);
  const amlScreeningRepository = new DrizzleAmlScreeningRepository(db);
  const amlHoldStore = new DrizzleAmlHoldStore(db);
  const sourceOfFundsRepository = new DrizzleSourceOfFundsRepository(db);
  const sourceOfFundsDocumentRepository = new DrizzleSourceOfFundsDocumentRepository(db);
  const sourceOfFundsDocumentReviewRepository = new DrizzleSourceOfFundsDocumentReviewRepository(
    db,
  );
  const sourceOfFundsSettlementReader = new DrizzleSourceOfFundsSettlementReader(db);
  const emailObservabilityRepository = new DrizzleEmailObservabilityRepository(db);
  const emailSuppressionRepository = new DrizzleEmailSuppressionRepository(db);
  const emailWebhookIngestRepository = new DrizzleEmailWebhookIngestRepository(db);
  const webhookEventRepository = new DrizzleWebhookEventRepository(db);

  return {
    notificationReadRepo,
    notificationWriteRepo,
    notificationAccountMuteRepository,
    notificationOutboxRepository,
    amlScreeningRepository,
    amlHoldStore,
    sourceOfFundsRepository,
    sourceOfFundsDocumentRepository,
    sourceOfFundsDocumentReviewRepository,
    sourceOfFundsSettlementReader,
    emailObservabilityRepository,
    emailSuppressionRepository,
    emailWebhookIngestRepository,
    webhookEventRepository,
  };
}
