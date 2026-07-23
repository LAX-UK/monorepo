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
import type {
  AdminSatelliteJobQueuesRoutesContainer,
  AdminSatelliteMarketingEventsRoutesContainer,
  AdminSatelliteOnsiteEventsRoutesContainer,
} from "../services/interfaces/admin-routes/admin-route-container-slices.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { BiddingRouteServices } from "../services/interfaces/bidding-routes.js";
import type { CatalogRouteServices } from "../services/interfaces/catalog-routes/index.js";
import type { ComplianceRouteServices } from "../services/interfaces/compliance-routes/index.js";
import type { FinanceRouteServices } from "../services/interfaces/finance-routes/index.js";
import type { IdentityRouteServices } from "../services/interfaces/identity-routes.js";
import type { ILotLifecycleService, ILotReadService } from "../services/interfaces/lot-service.js";
import type { PlatformCronRouteServices } from "../services/interfaces/platform-cron-routes/index.js";
import type { PlatformInboundWebhookRouteServices } from "../services/interfaces/platform-inbound-webhooks/index.js";
import type { IPushSubscriptionRepository } from "../services/interfaces/push.js";
import type {
  ISaleLifecycleService,
  ISaleLotMembershipService,
  ISaleReadService,
  ISaleWriteService,
} from "../services/interfaces/sale-service.js";
import type {
  ISaleroomSessionReadService,
  SaleroomServicePort,
} from "../services/interfaces/saleroom-service.js";
import type { SubmissionRouteServices } from "../services/interfaces/submission-routes/index.js";
import type {
  ITelephoneBidBookingBuyerService,
  ITelephoneBidBookingQueryService,
  ITelephoneBidBookingStaffService,
  TelephoneBidBookingServicePort,
} from "../services/interfaces/telephone-bid-booking-service.js";
import type { UserRouteServices } from "../services/interfaces/user-routes.js";
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
import type { ContainerUserNotificationComposition } from "./create-user-notification-composition.js";
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

/** Finance route application ports (statements, buyer HTTP, staff commands, cron ingress). */
export type ContainerFinanceSlice = {
  finance: FinanceRouteServices;
};

/** Platform maintenance cron ingress (lifecycle, hygiene). */
export type ContainerPlatformCronSlice = {
  platformCron: PlatformCronRouteServices;
};

/** Shopify + WordPress webhook claim ingress (platform integrations). */
export type ContainerPlatformInboundWebhooksSlice = {
  platformInboundWebhooks: PlatformInboundWebhookRouteServices;
};

/** Compliance route application ports (Veriff ingress, buyer SoF reads). */
export type ContainerComplianceSlice = {
  compliance: ComplianceRouteServices;
};

/** Catalog lifecycle HTTP route application ports (sale/lot commands). */
export type ContainerCatalogRoutesSlice = {
  catalogRoutes: CatalogRouteServices;
};

/** Item submission HTTP route application ports (seller/admin/documents). */
export type ContainerSubmissionRoutesServicesSlice = {
  submissionRoutes: SubmissionRouteServices;
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
  | "xeroOAuthService"
  | "adminMetricsService"
>;

export type ContainerBiddingSaleroomSlice = ContainerBiddingSaleroom;

export type ContainerUserProfileSlice = ContainerUserProfileServices;

export type ContainerUserUtilitySlice = ContainerUserUtilityServices;

export type ContainerUserMiscSlice = ContainerUserMiscServices;

export type ContainerUserNotificationSlice = ContainerUserNotificationComposition;

export type ContainerAdminSlice = Pick<ContainerAdminServices, "admin">;

export type ContainerCronSlice = Pick<
  ContainerCronServices,
  "accountDeletionEligibilityService" | "brevoWebhookIngestService"
>;

/** Route-facing admin bag (mirrors `container.admin`). */
export type ContainerAdminRoutesSlice = {
  admin: AdminRouteServices;
};

/** Route-facing bidding bag (mirrors `container.bidding`). */
export type ContainerBiddingRoutesSlice = {
  bidding: BiddingRouteServices;
};

/** Route-facing platform identity bag (mirrors `container.identityRoutes`). */
export type ContainerIdentityRoutesSlice = {
  identityRoutes: IdentityRouteServices;
};

/** Route-facing buyer user account bag (mirrors `container.userRoutes`). */
export type ContainerUserRouteServicesSlice = {
  userRoutes: UserRouteServices;
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
  ContainerBiddingSaleroomSlice &
  ContainerUserProfileSlice &
  ContainerUserUtilitySlice &
  ContainerUserNotificationSlice &
  ContainerAdminSlice &
  ContainerCronSlice &
  ContainerFinanceSlice &
  ContainerPlatformCronSlice &
  ContainerPlatformInboundWebhooksSlice &
  ContainerComplianceSlice &
  ContainerCatalogRoutesSlice &
  ContainerSubmissionRoutesServicesSlice &
  ContainerAdminRoutesSlice &
  ContainerBiddingRoutesSlice &
  ContainerIdentityRoutesSlice &
  ContainerUserRouteServicesSlice;

export type Container = ContainerComposedSlices;

/** Public sale catalogue HTTP handlers. */
export type ContainerSaleRoutesSlice = Pick<
  Container,
  | "userSuspensionChecker"
  | "kycService"
  | "requireSubmissionsLegalEntityContext"
  | "catalogRoutes"
  | "bidding"
>;

/** Sale read routes — public/admin catalogue detail only. */
export type ContainerSaleReadRoutesSlice = Pick<
  Container,
  "catalogRoutes" | "userSuspensionChecker"
>;

/** Sale lifecycle write routes — create, draft update, publish/unpublish/cancel. */
export type ContainerSaleLifecycleWriteRoutesSlice = Pick<
  Container,
  "userSuspensionChecker" | "kycService" | "catalogRoutes"
>;

/** Sale lot membership routes — add/attach/detach lots and cancel lots on a sale. */
export type ContainerSaleLotMembershipRoutesSlice = Pick<
  Container,
  "userSuspensionChecker" | "kycService" | "catalogRoutes"
>;

/** Sale follow routes — authenticated sale watchlist. */
export type ContainerSaleFollowRoutesSlice = Pick<Container, "catalogRoutes">;

/** Sale follow/registration routes — no lot/sale catalogue service ports. */
export type ContainerSaleAuxRoutesSlice = Pick<Container, "bidding">;

/** Minimal catalog + bidding route dependencies for lot HTTP handlers. */
export type ContainerLotRoutesSlice = Pick<Container, "bidding">;

/** Lot route wiring shared by `routes/lots/*` submodules. */
export type ContainerLotRouteDepsSlice = ContainerBiddingRoutesSlice &
  Pick<
    Container,
    | "env"
    | "redis"
    | "kycService"
    | "userSuspensionChecker"
    | "requireSubmissionsLegalEntityContext"
    | "catalogRoutes"
  >;

/** Lot read routes — public catalogue/detail only. */
export type ContainerLotReadRoutesSlice = Pick<
  Container,
  "catalogRoutes" | "userSuspensionChecker" | "bidding"
>;

/** Payment HTTP routes (buyer + staff payment endpoints). */
export type ContainerPaymentHttpRoutesSlice = ContainerFinanceSlice &
  Pick<
    Container,
    | "userSuspensionChecker"
    | "legalEntityRepository"
    | "impersonationAuditService"
    | "impersonationSessionService"
  >;

/** Standalone bid placement route (`routes/bids.ts`). */
export type ContainerBidRoutesSlice = Pick<
  Container,
  | "env"
  | "redis"
  | "bidding"
  | "userSuspensionChecker"
  | "kycService"
  | "requireSubmissionsLegalEntityContext"
>;

/** Public category listing. */
export type ContainerCategoryRoutesSlice = Pick<Container, "catalogRoutes">;

/** Press archive public reads. */
export type ContainerPressRoutesSlice = Pick<Container, "catalogRoutes" | "userSuspensionChecker">;

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

/** Shopify + WordPress inbound webhook routes. */
export type ContainerInboundWebhookClaimRoutesSlice = ContainerPlatformInboundWebhooksSlice;

/** Aggregated third-party webhook routes (`routes/webhooks/index.ts`). */
export type ContainerInboundWebhookRoutesSlice = ContainerBrevoWebhookRoutesSlice &
  ContainerPostmarkWebhookRoutesSlice &
  ContainerInboundWebhookClaimRoutesSlice;

/** JWKS well-known endpoint. */
export type ContainerWellKnownRoutesSlice = Pick<Container, "getPublicJwks">;

/** Venue CRUD (staff). */
export type ContainerVenueRoutesSlice = Pick<Container, "catalogRoutes" | "userSuspensionChecker">;

/** Public QR redirect + scan enqueue. */
export type ContainerQrRoutesSlice = Pick<Container, "qrCodeService">;

/** Authenticated marketing click-id capture. */
export type ContainerMarketingRoutesSlice = Pick<
  Container,
  "userSuspensionChecker" | "env" | "clickIdStore"
>;

/** Super-admin BullMQ queue inspector/mutator. */
export type ContainerAdminQueuesRoutesSlice = Pick<Container, "env"> &
  AdminSatelliteJobQueuesRoutesContainer;

/** Admin marketing event replay/stats. */
export type ContainerAdminMarketingEventsRoutesSlice = Pick<Container, "env"> &
  AdminSatelliteMarketingEventsRoutesContainer;

/** Saleroom display pairing + snapshot (public). */
export type ContainerSaleroomDisplayRoutesSlice = Pick<Container, "bidding">;

/** User account routes (`routes/users/*`). */
export type ContainerUserAccountRoutesSlice = Pick<
  Container,
  "userSuspensionChecker" | "env" | "authDb" | "userRoutes"
>;

/** Auth email/password flows. */
export type ContainerAuthRoutesSlice = Pick<
  Container,
  "env" | "redis" | "authenticator" | "userSuspensionChecker" | "authDb" | "identityRoutes"
>;

/** Buyer KYC session/status. */
export type ContainerKycRoutesSlice = ContainerComplianceSlice &
  Pick<Container, "userSuspensionChecker">;

/** Organisation wizard + public subkind/requirements. */
export type ContainerOrganizationRoutesSlice = Pick<
  Container,
  "userSuspensionChecker" | "orgModuleGate" | "identityRoutes"
>;

/** Per-entity onboarding steps (nested under organisations). */
export type ContainerOrganizationOnboardingRoutesSlice = Pick<
  Container,
  "userSuspensionChecker" | "orgModuleGate" | "identityRoutes"
>;

/** Legal entity membership + invitations (buyer). */
export type ContainerLegalEntityRoutesSlice = Pick<
  Container,
  "userSuspensionChecker" | "identityRoutes"
>;

/** Legal entity member admin (invite, roles, transfer). */
export type ContainerLegalEntityMemberRoutesSlice = Pick<
  Container,
  "userSuspensionChecker" | "requireLegalEntityContext" | "identityRoutes"
>;

/** Item submission seller + admin APIs. */
export type ContainerSubmissionRoutesSlice = Pick<
  Container,
  "submissionRoutes" | "userSuspensionChecker" | "requireSubmissionsLegalEntityContext"
>;

/** Submission document attach/list (staff shortcut). */
export type ContainerSubmissionDocumentRoutesSlice = Pick<
  Container,
  "submissionRoutes" | "userSuspensionChecker"
>;

/** Lot document attach/list. */
export type ContainerLotDocumentRoutesSlice = ContainerComplianceSlice &
  Pick<Container, "userSuspensionChecker">;

/** Sale document attach/list. */
export type ContainerSaleDocumentRoutesSlice = ContainerComplianceSlice &
  Pick<Container, "userSuspensionChecker">;

/** Presigned upload + local dev upload. */
export type ContainerUploadRoutesSlice = ContainerComplianceSlice &
  Pick<Container, "userSuspensionChecker">;

/** GDPR data export jobs. */
export type ContainerExportRoutesSlice = ContainerComplianceSlice &
  Pick<Container, "userSuspensionChecker">;

/** Artist registry + profile browse (public + staff). */
export type ContainerArtistRoutesSlice = Pick<Container, "userSuspensionChecker" | "catalogRoutes">;

/** Seller payout list/preview (legal entity scoped). */
export type ContainerPayoutRoutesSlice = ContainerFinanceSlice &
  Pick<Container, "userSuspensionChecker" | "requireLegalEntityContext">;

/** Staff payout settlement/adjustment. */
export type ContainerAdminPayoutRoutesSlice = Pick<Container, "userSuspensionChecker"> & {
  admin: Pick<import("../services/interfaces/admin-routes.js").AdminRouteServices, "payouts">;
};

/** Seller payout statement download. */
export type ContainerPayoutStatementRoutesSlice = ContainerFinanceSlice &
  Pick<Container, "userSuspensionChecker">;

/** Stripe Connect onboarding (seller). */
export type ContainerStripeConnectRoutesSlice = ContainerFinanceSlice &
  Pick<Container, "userSuspensionChecker" | "requireLegalEntityContext">;

/** Stripe connect/transfers/payments webhooks. */
export type ContainerStripeWebhookRoutesSlice = ContainerFinanceSlice;

/** Veriff KYC + AML watchlist webhooks. */
export type ContainerVeriffWebhookRoutesSlice = ContainerComplianceSlice;

/** Xero invoice webhook ingest. */
export type ContainerXeroWebhookRoutesSlice = ContainerFinanceSlice;

/** Buyer telephone bid booking HTTP routes. */
export type ContainerBuyerTelephoneBookingRoutesSlice = Pick<
  Container,
  "bidding" | "userSuspensionChecker" | "kycService"
>;

/** Staff telephone bid booking HTTP routes (platform shell). */
export type ContainerAdminTelephoneBookingRoutesSlice = Pick<Container, "admin">;

/** @deprecated Use ContainerBuyerTelephoneBookingRoutesSlice or ContainerAdminTelephoneBookingRoutesSlice. */
export type ContainerTelephoneBookingRoutesSlice = ContainerBuyerTelephoneBookingRoutesSlice &
  ContainerAdminTelephoneBookingRoutesSlice;

/** Internal cron tick endpoints. */
export type ContainerInternalCronRoutesSlice = ContainerFinanceSlice &
  ContainerPlatformCronSlice &
  Pick<Container, "absenteeBidService">;

/** Admin onsite event CRUD + check-in. */
export type ContainerAdminOnsiteEventRoutesSlice = Pick<Container, "redis"> &
  AdminSatelliteOnsiteEventsRoutesContainer;

/** Top-level admin platform shell (request lifecycle + nested admin services). */
export type ContainerAdminPlatformRoutesSlice = ContainerAdminRoutesSlice &
  Pick<Container, "redis"> &
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
