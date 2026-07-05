import type { Auth } from "@auction/auth/server";
import type { createDb } from "@auction/db";
import type {
  IAttentionFeedReader,
  IEmailObservabilityRepository,
  IItemSubmissionRepository,
  IKycRepository,
  ILegalEntityNotificationRecipientReader,
  ILegalEntityRepository,
  INotificationPreferenceRepository,
  IPayoutRepository,
  IPendingInvitationsReader,
  IRepositoryFactory,
  IUiPreferenceRepository,
  IUserEmailChangeRepository,
  IWebhookEventRepository,
  IXeroWebhookEventRepository,
} from "@auction/persistence/interfaces";
import type { Env } from "../env.js";
import type { AdminRouteServices } from "../services/interfaces/admin-routes.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { BiddingRouteServices } from "../services/interfaces/bidding-routes.js";
import type {
  ILotLifecycleService,
  ILotReadService,
  ILotService,
} from "../services/interfaces/lot-service.js";
import type {
  IPaymentAdminService,
  IPaymentBuyerService,
  IPaymentMaintenanceService,
} from "../services/interfaces/payment-service.js";
import type { IPushSubscriptionRepository } from "../services/interfaces/push.js";
import type {
  ISaleLifecycleService,
  ISaleLotMembershipService,
  ISaleReadService,
  ISaleService,
  ISaleWriteService,
} from "../services/interfaces/sale-service.js";
import type {
  ISaleroomSessionReadService,
  SaleroomServicePort,
} from "../services/interfaces/saleroom-service.js";
import type {
  ITelephoneBidBookingBuyerService,
  ITelephoneBidBookingQueryService,
  ITelephoneBidBookingStaffService,
  TelephoneBidBookingServicePort,
} from "../services/interfaces/telephone-bid-booking-service.js";
import type {
  IUserSuspensionCacheInvalidator,
  IUserSuspensionChecker,
} from "../services/interfaces/user-suspension.js";
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

/** Segregated lot/sale ports for route-level ISP narrowing. */
export type LotReadPort = ILotReadService;
export type LotLifecyclePort = ILotReadService & ILotLifecycleService;
export type SaleReadPort = ISaleReadService;
export type SaleLookupPort = Pick<ISaleReadService, "findByIds">;
export type SaleLifecycleWritePort = ISaleWriteService & ISaleLifecycleService;
export type SaleLotMembershipPort = ISaleLotMembershipService;
export type SaleroomReadPort = ISaleroomSessionReadService;
export type { SaleroomServicePort, TelephoneBidBookingServicePort };
export type TelephoneBookingRoutePort = ITelephoneBidBookingBuyerService &
  ITelephoneBidBookingStaffService &
  ITelephoneBidBookingQueryService;

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
  | "domainEventSink"
  | "transactionRunner"
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

/** Public sale catalogue HTTP handlers. */
export type ContainerSaleRoutesSlice = Omit<
  Pick<
    Container,
    | "saleService"
    | "saleListReadService"
    | "saleFollowService"
    | "saleRegistrationService"
    | "saleBiddersService"
    | "saleStatusTransitionService"
    | "saleSoftDeleteService"
    | "lotService"
    | "cachedCatalogueListService"
    | "repoFactory"
    | "saleroomService"
    | "stripeConnectService"
    | "legalEntityRepository"
    | "userSuspensionChecker"
    | "kycService"
    | "mediaUrlResolver"
    | "mediaAssetEnricher"
  >,
  "saleService" | "lotService" | "saleroomService"
> & {
  saleService: ISaleService;
  lotService: LotLifecyclePort;
  saleroomService: SaleroomServicePort;
};

/** Sale read routes — public/admin catalogue detail only. */
export type ContainerSaleReadRoutesSlice = Omit<
  ContainerSaleRoutesSlice,
  "saleService" | "lotService" | "saleroomService"
> & {
  saleService: SaleReadPort;
  saleroomService: SaleroomReadPort;
};

/** Sale lifecycle write routes — create, draft update, publish/unpublish/cancel. */
export type ContainerSaleLifecycleWriteRoutesSlice = Omit<
  ContainerSaleRoutesSlice,
  "saleService" | "lotService"
> & {
  saleService: SaleLifecycleWritePort;
};

/** Sale lot membership routes — add/attach/detach lots and cancel lots on a sale. */
export type ContainerSaleLotMembershipRoutesSlice = Omit<
  ContainerSaleRoutesSlice,
  "saleService" | "lotService"
> & {
  saleService: SaleLotMembershipPort;
  lotService: LotLifecyclePort;
};

/** Sale follow/registration routes — no lot/sale catalogue service ports. */
export type ContainerSaleAuxRoutesSlice = Omit<
  ContainerSaleRoutesSlice,
  "saleService" | "lotService"
>;

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
export type ContainerLotRouteDepsSlice = Omit<
  ContainerLotRoutesSlice &
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
    >,
  "lotService" | "saleService"
> & {
  lotService: ILotService;
  saleService: SaleReadPort;
};

/** Lot read routes — public catalogue/detail only. */
export type ContainerLotReadRoutesSlice = Omit<
  ContainerLotRouteDepsSlice,
  "lotService" | "saleService"
> & {
  lotService: LotReadPort;
  saleService: SaleReadPort;
};

/** Minimal payment route dependencies. */
export type ContainerPaymentRoutesSlice = Pick<
  Container,
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

/** Venue CRUD (staff). */
export type ContainerVenueRoutesSlice = Pick<Container, "venueService" | "userSuspensionChecker">;

/** Public QR redirect + scan enqueue. */
export type ContainerQrRoutesSlice = Pick<Container, "qrCodeService">;

/** Authenticated marketing click-id capture. */
export type ContainerMarketingRoutesSlice = Pick<
  Container,
  "userSuspensionChecker" | "env" | "clickIdStore"
>;

/** Super-admin BullMQ queue inspector/mutator. */
export type ContainerAdminQueuesRoutesSlice = Pick<Container, "env" | "queueAdmin">;

/** Admin marketing event replay/stats. */
export type ContainerAdminMarketingEventsRoutesSlice = Pick<
  Container,
  "env" | "adminMarketingEventsService"
>;

/** Saleroom display pairing + snapshot (public). */
export type ContainerSaleroomDisplayRoutesSlice = Pick<
  Container,
  "displayPairingService" | "displaySnapshotReader"
>;

/** User account routes (`routes/users/*`). */
export type ContainerUserRoutesSlice = Omit<
  Pick<
    Container,
    | "userSuspensionChecker"
    | "env"
    | "authDb"
    | "conditionReportService"
    | "userDashboardReadService"
    | "lotService"
    | "paymentBuyerService"
    | "mediaUrlResolver"
    | "mediaAssetEnricher"
    | "notificationQueryService"
    | "watchlistService"
    | "repoFactory"
    | "marketingEventService"
    | "artistWatchlistService"
    | "savedSearchService"
    | "vapidPublicKey"
    | "pushSubscriptionRepository"
    | "notificationPreferenceRepository"
    | "uiPreferenceService"
    | "profileService"
    | "addressService"
    | "sessionRevocation"
    | "authAuditPublisher"
    | "userSecurityReadService"
    | "userService"
    | "emailService"
    | "accountDeletionEligibilityService"
    | "registrationService"
    | "saleService"
  >,
  "lotService" | "saleService"
> & {
  lotService: LotReadPort;
  saleService: SaleLookupPort;
};

/** Auth email/password flows. */
export type ContainerAuthRoutesSlice = Pick<
  Container,
  | "env"
  | "redis"
  | "authenticator"
  | "userSuspensionChecker"
  | "authDb"
  | "authAuditPublisher"
  | "userService"
  | "userEmailChangeRepository"
  | "emailService"
  | "sessionRevocation"
  | "authCredentialReader"
  | "auth"
  | "db"
>;

/** Buyer KYC session/status. */
export type ContainerKycRoutesSlice = Pick<Container, "userSuspensionChecker" | "kycService">;

/** Organisation wizard + public subkind/requirements. */
export type ContainerOrganizationRoutesSlice = Pick<
  Container,
  | "userSuspensionChecker"
  | "organizationOnboardingService"
  | "orgModuleGate"
  | "organizationOnboardingFlowService"
  | "env"
>;

/** Per-entity onboarding steps (nested under organisations). */
export type ContainerOrganizationOnboardingRoutesSlice = Pick<
  Container,
  "userSuspensionChecker" | "env" | "organizationOnboardingFlowService"
>;

/** Legal entity membership + invitations (buyer). */
export type ContainerLegalEntityRoutesSlice = Pick<
  Container,
  | "userSuspensionChecker"
  | "legalEntityRepository"
  | "personalLegalEntityResolver"
  | "orgModuleGate"
  | "userService"
  | "pendingInvitationsReader"
  | "invitationLifecycleService"
  | "legalEntityAccessService"
>;

/** Legal entity member admin (invite, roles, transfer). */
export type ContainerLegalEntityMemberRoutesSlice = Pick<
  Container,
  | "userSuspensionChecker"
  | "requireLegalEntityContext"
  | "memberManagementService"
  | "invitationLifecycleService"
  | "orgModuleGate"
  | "userService"
>;

/** Item submission seller + admin APIs. */
export type ContainerSubmissionRoutesSlice = Pick<
  Container,
  | "userSuspensionChecker"
  | "requireSubmissionsLegalEntityContext"
  | "itemSubmissionSellerApi"
  | "itemSubmissionAdminApi"
  | "submissionDocumentService"
>;

/** Submission document attach/list. */
export type ContainerSubmissionDocumentRoutesSlice = Pick<
  Container,
  "userSuspensionChecker" | "submissionDocumentService"
>;

/** Lot document attach/list. */
export type ContainerLotDocumentRoutesSlice = Pick<
  Container,
  "userSuspensionChecker" | "lotDocumentService"
>;

/** Sale document attach/list. */
export type ContainerSaleDocumentRoutesSlice = Pick<
  Container,
  "userSuspensionChecker" | "saleDocumentService"
>;

/** Presigned upload + local dev upload. */
export type ContainerUploadRoutesSlice = Pick<
  Container,
  "userSuspensionChecker" | "env" | "uploadService"
>;

/** GDPR data export jobs. */
export type ContainerExportRoutesSlice = Pick<Container, "userSuspensionChecker" | "exportService">;

/** Artist registry + profile browse (public + staff). */
export type ContainerArtistRoutesSlice = Pick<
  Container,
  "userSuspensionChecker" | "artistRegistryService" | "artistProfileService" | "artistDeleteService"
>;

/** Seller payout list/preview (legal entity scoped). */
export type ContainerPayoutRoutesSlice = Pick<
  Container,
  "userSuspensionChecker" | "requireLegalEntityContext" | "payoutService"
>;

/** Staff payout settlement/adjustment. */
export type ContainerAdminPayoutRoutesSlice = Pick<
  Container,
  "userSuspensionChecker" | "payoutRepository" | "payoutStatementQueue" | "payoutService"
>;

/** Seller payout statement download. */
export type ContainerPayoutStatementRoutesSlice = Pick<
  Container,
  "userSuspensionChecker" | "legalEntityRepository" | "payoutRepository" | "payoutStatementQueue"
>;

/** Stripe Connect onboarding (seller). */
export type ContainerStripeConnectRoutesSlice = Pick<
  Container,
  "userSuspensionChecker" | "requireLegalEntityContext" | "stripeConnectService"
>;

/** Stripe connect/transfers/payments webhooks. */
export type ContainerStripeWebhookRoutesSlice = Pick<
  Container,
  "stripeWebhookVerifier" | "stripeConnectService" | "stripePaymentWebhookService"
>;

/** Veriff KYC + AML watchlist webhooks. */
export type ContainerVeriffWebhookRoutesSlice = Pick<
  Container,
  | "transactionRunner"
  | "legalEntityRepository"
  | "domainEventSink"
  | "amlService"
  | "stripeConnectService"
  | "kycService"
  | "marketingEventService"
  | "db"
  | "kycResubmissionNotifier"
>;

/** Xero invoice webhook ingest. */
export type ContainerXeroWebhookRoutesSlice = Pick<
  Container,
  "env" | "xeroWebhookEventRepository" | "accountingProvider"
>;

/** Telephone bid booking (buyer + staff). */
export type ContainerTelephoneBookingRoutesSlice = Omit<
  Pick<Container, "telephoneBidBookingService" | "userSuspensionChecker" | "kycService">,
  "telephoneBidBookingService"
> & {
  telephoneBidBookingService: TelephoneBookingRoutePort;
};

/** Internal cron tick endpoints. */
export type ContainerInternalCronRoutesSlice = Pick<
  Container,
  | "redis"
  | "settlementCronService"
  | "paymentMaintenanceCronService"
  | "accountingReplayCronService"
  | "hygieneCronService"
  | "lifecycleCronService"
>;

/** Admin onsite event CRUD + check-in. */
export type ContainerAdminOnsiteEventRoutesSlice = Pick<
  Container,
  "redis" | "onsiteEventAdminService" | "onsiteEventStaffCheckInService"
>;

/** Top-level admin platform shell (request lifecycle + nested admin services). */
export type ContainerAdminPlatformRoutesSlice = ContainerAdminRoutesSlice &
  ContainerTelephoneBookingRoutesSlice &
  ContainerAdminOnsiteEventRoutesSlice &
  ContainerAdminMarketingEventsRoutesSlice &
  ContainerAdminQueuesRoutesSlice;

/** Password step-up middleware minimum deps. */
export type ContainerPasswordStepUpSlice = Pick<Container, "authDb">;

/** Forgot-password side effects. */
export type ContainerForgotPasswordSlice = Pick<
  Container,
  "db" | "authDb" | "auth" | "emailService" | "env"
>;

/** Credential password setup. */
export type ContainerCredentialSetupSlice = Pick<
  Container,
  "userService" | "auth" | "authDb" | "emailService"
>;

defineCompileTimeContainerSliceContract();

function defineCompileTimeContainerSliceContract(): void {
  const _assertComposed: Container = undefined as unknown as ContainerComposedSlices;
  void _assertComposed;
}
