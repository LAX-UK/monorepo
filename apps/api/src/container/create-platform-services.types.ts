import type { ITransactionRunner } from "@auction/persistence/interfaces";
import type { CachedUserSuspensionChecker } from "../infrastructure/cached-user-suspension.checker.js";
import type { RedisUserNotificationPublisher } from "../infrastructure/redis-user-notification.publisher.js";
import type { createRequireLegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { AuthAuditPublisher } from "../services/auth-audit.publisher.js";
import type { CachedCatalogueListService } from "../services/cached-catalogue-list.service.js";
import type { IDomainEventSink } from "../services/domain-event-sink.js";
import type { ImpersonationAuditService } from "../services/impersonation-audit.service.js";
import type { ImpersonationSessionService } from "../services/impersonation-session.service.js";
import type { IArtistRegistryService } from "../services/interfaces/artist-registry.js";
import type { IInvitationLifecycleService } from "../services/interfaces/invitation-lifecycle.js";
import type { ILotLifecycleRecorder } from "../services/interfaces/lot-lifecycle-recorder.js";
import type { IMemberManagementService } from "../services/interfaces/member-management.js";
import type { IOrganizationOnboardingService } from "../services/interfaces/organization-onboarding.js";
import type {
  IPayoutAdminService,
  IPayoutMaintenanceService,
  IPayoutSellerService,
  IPayoutService,
  IPayoutSettlementService,
} from "../services/interfaces/payout.js";
import type { IStripeConnectService } from "../services/interfaces/stripe-connect.js";
import type { ITransactionalMailer } from "../services/interfaces/transactional-mail.js";
import type { InvoiceAddressingService } from "../services/invoice-addressing.js";
import type { LegalEntityAccessService } from "../services/legal-entity-access.service.js";
import type { LegalEntityLifecycleAdminService } from "../services/legal-entity-lifecycle-admin.service.js";
import type { LotLifecycleEventRecorder } from "../services/lot-lifecycle-event-recorder.js";
import type { NotificationOutboxProcessor } from "../services/notification-outbox.processor.js";
import type { NotificationOutboxService } from "../services/notification-outbox.service.js";
import type { NotificationDispatcher } from "../services/notification.dispatcher.js";
import type { NotificationFactory } from "../services/notification.factory.js";
import type { NotificationService } from "../services/notification.service.js";
import type { OrganizationOnboardingFlowService } from "../services/organization-onboarding/organization-onboarding-flow.service.js";
import type { PaymentRefundReconcileService } from "../services/payment/payment-refund-reconcile.service.js";
import type { PayoutAdjustmentService } from "../services/payout/payout-adjustment.service.js";
import type { UiPreferenceService } from "../services/ui-preference.service.js";
import type { LotStrategyFactory } from "../strategies/strategy.factory.js";
import type { ContainerPlatformCore } from "./create-platform-core.js";
import type { ContainerPlatformIdentityServices } from "./create-platform-identity-services.js";
import type { ContainerPlatformNotificationServices } from "./create-platform-notification-services.js";
import type { ContainerPlatformPayoutServices } from "./create-platform-payout-services.js";

export type ContainerPlatformServices = ContainerPlatformCore &
  ContainerPlatformPayoutServices &
  ContainerPlatformNotificationServices &
  ContainerPlatformIdentityServices;

/** @deprecated Prefer sub-slice types from create-platform-*-services.ts for narrow deps. */
export type ContainerPlatformServicesLegacy = {
  domainEventSink: IDomainEventSink;
  transactionRunner: ITransactionRunner;
  lotLifecycleEventRecorder: LotLifecycleEventRecorder;
  lotLifecycleRecording: ILotLifecycleRecorder;
  authAuditPublisher: AuthAuditPublisher;
  organizationOnboardingService: IOrganizationOnboardingService;
  impersonationAuditService: ImpersonationAuditService;
  impersonationSessionService: ImpersonationSessionService;
  legalEntityAccessService: LegalEntityAccessService;
  requireLegalEntityContext: ReturnType<typeof createRequireLegalEntityContext>;
  artistRegistryService: IArtistRegistryService;
  memberManagementService: IMemberManagementService;
  transactionalMailer: ITransactionalMailer;
  invitationLifecycleService: IInvitationLifecycleService;
  payoutAdjustmentService: PayoutAdjustmentService;
  payoutService: IPayoutService;
  payoutSellerService: IPayoutSellerService;
  payoutAdminService: IPayoutAdminService;
  payoutSettlementService: IPayoutSettlementService;
  payoutMaintenanceService: IPayoutMaintenanceService;
  stripeConnectService: IStripeConnectService;
  organizationOnboardingFlowService: OrganizationOnboardingFlowService;
  legalEntityLifecycleAdminService: LegalEntityLifecycleAdminService;
  paymentRefundReconcileService: PaymentRefundReconcileService;
  uiPreferenceService: UiPreferenceService;
  invoiceAddressingService: InvoiceAddressingService;
  cachedUserSuspensionChecker: CachedUserSuspensionChecker;
  cachedCatalogueListService: CachedCatalogueListService;
  userNotificationPublisher: RedisUserNotificationPublisher;
  notificationService: NotificationService;
  strategyFactory: LotStrategyFactory;
  notificationFactory: NotificationFactory;
  notificationDispatcher: NotificationDispatcher;
  notificationOutboxService: NotificationOutboxService;
  notificationOutboxProcessor: NotificationOutboxProcessor;
};

defineCompileTimePlatformServicesContract();

function defineCompileTimePlatformServicesContract(): void {
  type _AssertPlatformServicesMatchLegacy =
    ContainerPlatformServices extends ContainerPlatformServicesLegacy
      ? ContainerPlatformServicesLegacy extends ContainerPlatformServices
        ? true
        : never
      : never;
  void (undefined as unknown as _AssertPlatformServicesMatchLegacy);
}
