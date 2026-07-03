import type { Auth } from "@auction/auth/server";
import type { createDb } from "@auction/db";
import type { Env } from "../env.js";
import type { IUserEmailChangeRepository } from "../repositories/interfaces/user-email-change.repository.js";
import type { IWebhookEventRepository } from "../repositories/interfaces/webhook-event.repository.js";
import type { AdminRouteServices } from "../services/interfaces/admin-routes.js";
import type { IAttentionFeedReader } from "../services/interfaces/attention-feed.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { BiddingRouteServices } from "../services/interfaces/bidding-routes.js";
import type { IEmailObservabilityRepository } from "../services/interfaces/email-observability.js";
import type { IKycRepository } from "../services/interfaces/kyc-repository.js";
import type { ILegalEntityNotificationRecipientReader } from "../services/interfaces/legal-entity-notification-recipients.js";
import type { ILegalEntityRepository } from "../services/interfaces/legal-entity-repository.js";
import type { INotificationPreferenceRepository } from "../services/interfaces/notification-preference.js";
import type {
  IPaymentAdminService,
  IPaymentBuyerService,
  IPaymentMaintenanceService,
  IPaymentService,
} from "../services/interfaces/payment-service.js";
import type { IPayoutRepository } from "../services/interfaces/payout-repository.js";
import type { IPendingInvitationsReader } from "../services/interfaces/pending-invitations-reader.js";
import type { IPushSubscriptionRepository } from "../services/interfaces/push.js";
import type { IItemSubmissionRepository } from "../services/interfaces/repositories.js";
import type { IRepositoryFactory } from "../services/interfaces/repository-factory.js";
import type { IUiPreferenceRepository } from "../services/interfaces/ui-preference.js";
import type {
  IUserSuspensionCacheInvalidator,
  IUserSuspensionChecker,
} from "../services/interfaces/user-suspension.js";
import type { IXeroWebhookEventRepository } from "../services/interfaces/xero-repositories.js";
import type { SessionRevocationService } from "../services/session-revocation.service.js";
import type { ContainerAdminServices } from "./create-admin-services.js";
import type { ContainerBiddingSaleroom } from "./create-bidding-saleroom.js";
import type { ContainerCatalogAdminReaders } from "./create-catalog-admin-readers.js";
import type { ContainerComplianceMedia } from "./create-compliance-media.js";
import type { ContainerCronServices } from "./create-cron-services.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerLotCatalogServices } from "./create-lot-catalog-services.js";
import type { ContainerLotLifecycle } from "./create-lot-lifecycle.js";
import type { ContainerOnsiteEventServices } from "./create-onsite-event-services.js";
import type { ContainerPaymentsServices } from "./create-payments-services.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";
import type { ContainerRepositories } from "./create-repositories.js";
import type { ContainerSaleRegistrationServices } from "./create-sale-registration-services.js";
import type { ContainerUserMiscServices } from "./create-user-misc-services.js";
import type { ContainerUserProfileServices } from "./create-user-profile-services.js";
import type { ContainerUserUtilityServices } from "./create-user-utility-services.js";

/** Runtime wiring owned by `createContainer()` (not a factory module). */
export type ContainerRootSlice = {
  env: Env;
  db: ReturnType<typeof createDb>;
  authDb: ReturnType<typeof createDb>;
  sessionRevocation: SessionRevocationService;
  vapidPublicKey: string | null;
  auth: Auth;
  authenticator: IAuthenticator;
};

/** Repository ports re-exposed on the flat container bag (internal repos stay in factories). */
export type ContainerExposedRepositoriesSlice = {
  repoFactory: IRepositoryFactory;
  webhookEventRepository: IWebhookEventRepository;
  itemSubmissionRepository: IItemSubmissionRepository;
  userEmailChangeRepository: IUserEmailChangeRepository;
  legalEntityRepository: ILegalEntityRepository;
  legalEntityNotificationRecipients: ILegalEntityNotificationRecipientReader;
  kycRepository: IKycRepository;
  pendingInvitationsReader: IPendingInvitationsReader;
  payoutRepository: IPayoutRepository;
  notificationPreferenceRepository: INotificationPreferenceRepository;
  uiPreferenceRepository: IUiPreferenceRepository;
  pushSubscriptionRepository: IPushSubscriptionRepository;
  emailObservabilityRepository: IEmailObservabilityRepository;
  attentionFeedReader: IAttentionFeedReader;
  xeroWebhookEventRepository: IXeroWebhookEventRepository;
};

/** Segregated payment HTTP ports mapped to the same runtime service instance. */
export type ContainerPaymentExposureSlice = {
  paymentService: IPaymentService;
  paymentBuyerService: IPaymentBuyerService;
  paymentAdminService: IPaymentAdminService;
  paymentMaintenanceService: IPaymentMaintenanceService;
};

/** Platform suspension ports exposed under route-facing names. */
export type ContainerUserSuspensionExposureSlice = {
  userSuspensionChecker: IUserSuspensionChecker;
  userSuspensionCacheInvalidator: IUserSuspensionCacheInvalidator;
};

/** Domain-scoped slices aligned with container factory modules. */
export type ContainerInfraSlice = Pick<
  ContainerInfra,
  | "redis"
  | "rateLimitStore"
  | "getPublicJwks"
  | "emailService"
  | "objectStorage"
  | "stripeClientFactory"
  | "stripeWebhookVerifier"
  | "uploadValidationQueue"
  | "imageCleanupQueue"
  | "marketingSyncQueue"
  | "dataExportQueue"
  | "payoutStatementQueue"
  | "legalEntityArchiveQueue"
>;

export type ContainerRepositoriesSlice = ContainerRepositories;

export type ContainerPlatformSlice = Pick<
  ContainerPlatformServices,
  | "domainEventPublisher"
  | "authAuditPublisher"
  | "notificationFactory"
  | "organizationOnboardingService"
  | "impersonationAuditService"
  | "impersonationSessionService"
  | "legalEntityAccessService"
  | "requireLegalEntityContext"
  | "artistRegistryService"
  | "memberManagementService"
  | "transactionalMailer"
  | "invitationLifecycleService"
  | "payoutService"
  | "payoutSellerService"
  | "payoutAdminService"
  | "payoutSettlementService"
  | "payoutMaintenanceService"
  | "stripeConnectService"
  | "organizationOnboardingFlowService"
  | "legalEntityLifecycleAdminService"
  | "paymentRefundReconcileService"
  | "uiPreferenceService"
  | "invoiceAddressingService"
  | "cachedCatalogueListService"
  | "notificationService"
  | "notificationDispatcher"
  | "notificationOutboxProcessor"
>;

export type ContainerLotLifecycleSlice = Pick<
  ContainerLotLifecycle,
  "lotLifecycleService" | "saleLifecycleService"
>;

export type ContainerComplianceMediaSlice = Pick<
  ContainerComplianceMedia,
  | "marketingEventService"
  | "marketingEventPublisher"
  | "clickIdStore"
  | "kycService"
  | "kycResubmissionNotifier"
  | "amlService"
  | "sourceOfFundsService"
  | "adminSourceOfFundsQueryService"
  | "sourceOfFundsDocumentCollectionService"
  | "sourceOfFundsDocumentReviewService"
  | "exportService"
  | "mediaUrlResolver"
  | "mediaAssetEnricher"
  | "legalEntityDocumentAdminService"
  | "uploadService"
  | "lotDocumentService"
  | "saleDocumentService"
  | "submissionDocumentService"
>;

export type ContainerLotCatalogSlice = ContainerLotCatalogServices;

export type ContainerSaleRegistrationSlice = Pick<
  ContainerSaleRegistrationServices,
  "telephoneBidBookingService" | "paddleService" | "saleroomCheckInService"
>;

export type ContainerLotSaleSlice = ContainerLotCatalogSlice & ContainerSaleRegistrationSlice;

export type ContainerOnsiteEventSlice = ContainerOnsiteEventServices;

export type ContainerCatalogAdminReadersSlice = ContainerCatalogAdminReaders;

export type ContainerCatalogSlice = ContainerLotCatalogSlice &
  ContainerSaleRegistrationSlice &
  ContainerOnsiteEventSlice &
  ContainerCatalogAdminReadersSlice;

export type ContainerPaymentsSlice = Pick<
  ContainerPaymentsServices,
  | "accountingProvider"
  | "xeroPayoutBillWriter"
  | "xeroPaymentRecorder"
  | "lotFulfilmentService"
  | "lotInvoiceInitiationService"
  | "stripePaymentWebhookService"
  | "xeroOAuthService"
  | "adminMetricsService"
>;

export type ContainerBiddingSaleroomSlice = ContainerBiddingSaleroom;

export type ContainerUserProfileSlice = ContainerUserProfileServices;

export type ContainerUserUtilitySlice = ContainerUserUtilityServices;

export type ContainerUserMiscSlice = ContainerUserMiscServices;

export type ContainerAdminSlice = ContainerAdminServices;

export type ContainerCronSlice = ContainerCronServices;

/** Route-facing admin bag (mirrors `container.admin`). */
export type ContainerAdminRoutesSlice = {
  admin: AdminRouteServices;
};

/** Route-facing bidding bag (mirrors `container.bidding`). */
export type ContainerBiddingRoutesSlice = {
  bidding: BiddingRouteServices;
};

/** Composed root container slices (single source of truth for `Container`). */
export type ContainerComposedSlices = ContainerRootSlice &
  ContainerInfraSlice &
  ContainerExposedRepositoriesSlice &
  ContainerPlatformSlice &
  ContainerUserSuspensionExposureSlice &
  ContainerLotLifecycleSlice &
  ContainerComplianceMediaSlice &
  ContainerCatalogSlice &
  ContainerPaymentsSlice &
  ContainerPaymentExposureSlice &
  ContainerBiddingSaleroomSlice &
  ContainerUserProfileSlice &
  ContainerUserUtilitySlice &
  ContainerAdminSlice &
  ContainerCronSlice &
  ContainerAdminRoutesSlice &
  ContainerBiddingRoutesSlice;

export type Container = ContainerComposedSlices;

/** Minimal catalog + bidding route dependencies for lot HTTP handlers. */
export type ContainerLotRoutesSlice = Pick<
  Container,
  | "lotService"
  | "bidService"
  | "autoBidService"
  | "absenteeBidService"
  | "conditionReportService"
  | "bidding"
>;

/** Lot route wiring shared by `routes/lots/*` submodules. */
export type ContainerLotRouteDepsSlice = ContainerLotRoutesSlice &
  ContainerBiddingRoutesSlice &
  Pick<
    Container,
    | "env"
    | "redis"
    | "db"
    | "kycService"
    | "userSuspensionChecker"
    | "requireSubmissionsLegalEntityContext"
    | "lotSoftDeleteService"
    | "lotLifecycleQueryService"
    | "saleService"
    | "mediaUrlResolver"
    | "mediaAssetEnricher"
    | "objectStorage"
    | "cachedCatalogueListService"
    | "stripeConnectService"
    | "legalEntityRepository"
  >;

/** Minimal payment route dependencies. */
export type ContainerPaymentRoutesSlice = Pick<
  Container,
  | "paymentService"
  | "paymentBuyerService"
  | "paymentAdminService"
  | "stripeConnectService"
  | "lotInvoiceInitiationService"
>;

/** Payment HTTP routes (buyer + admin payment endpoints). */
export type ContainerPaymentHttpRoutesSlice = ContainerPaymentRoutesSlice &
  Pick<
    Container,
    | "env"
    | "redis"
    | "userSuspensionChecker"
    | "legalEntityRepository"
    | "impersonationAuditService"
    | "impersonationSessionService"
    | "sourceOfFundsDocumentCollectionService"
    | "lotFulfilmentService"
    | "marketingEventService"
  >;

/** Standalone bid placement route (`routes/bids.ts`). */
export type ContainerBidRoutesSlice = Pick<
  Container,
  | "env"
  | "redis"
  | "bidService"
  | "userSuspensionChecker"
  | "kycService"
  | "requireSubmissionsLegalEntityContext"
>;

/** Public category listing. */
export type ContainerCategoryRoutesSlice = Pick<Container, "categoryService">;

/** Press archive public reads. */
export type ContainerPressRoutesSlice = Pick<Container, "pressArchiveReadService">;

/** Guest/staff onsite event HTTP handlers. */
export type ContainerOnsiteEventRoutesSlice = Pick<
  Container,
  | "env"
  | "redis"
  | "onsiteEventPublicRsvpService"
  | "onsiteEventPassService"
  | "onsiteEventStaffCheckInService"
>;

/** Newsletter signup. */
export type ContainerNewsletterRoutesSlice = Pick<Container, "newsletterSignupService">;

/** Email unsubscribe + preview. */
export type ContainerEmailRoutesSlice = Pick<
  Container,
  "env" | "userService" | "emailUnsubscribeService"
>;

/** Brevo marketing webhook ingest. */
export type ContainerBrevoWebhookRoutesSlice = Pick<Container, "env" | "brevoWebhookIngestService">;

/** Postmark delivery webhook. */
export type ContainerPostmarkWebhookRoutesSlice = Pick<Container, "env" | "postmarkWebhookService">;

/** Shopify + WordPress inbound webhook claim. */
export type ContainerInboundWebhookClaimRoutesSlice = Pick<
  Container,
  "env" | "webhookEventRepository"
>;

/** Aggregated third-party webhook routes (`routes/webhooks/index.ts`). */
export type ContainerInboundWebhookRoutesSlice = ContainerBrevoWebhookRoutesSlice &
  ContainerPostmarkWebhookRoutesSlice &
  ContainerInboundWebhookClaimRoutesSlice;

/** JWKS well-known endpoint. */
export type ContainerWellKnownRoutesSlice = Pick<Container, "getPublicJwks">;

defineCompileTimeContainerSliceContract();

function defineCompileTimeContainerSliceContract(): void {
  const _assertComposed: Container = undefined as unknown as ContainerComposedSlices;
  void _assertComposed;
}
