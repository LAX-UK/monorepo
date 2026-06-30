import type { Database } from "@auction/db";
import { user } from "@auction/db/schema";
import { LEGAL_ENTITY_ARCHIVE_JOB_NAME } from "@auction/queues";
import { and, eq, isNull } from "drizzle-orm";
import type { Env } from "../env.js";
import { CachedUserSuspensionChecker } from "../infrastructure/cached-user-suspension.checker.js";
import { EmailNotificationChannel } from "../infrastructure/email-notification.channel.js";
import { InAppNotificationChannel } from "../infrastructure/in-app-notification.channel.js";
import { NoOpPushSender } from "../infrastructure/no-op-push.sender.js";
import { PushNotificationChannel } from "../infrastructure/push-notification.channel.js";
import { RedisNotificationSender } from "../infrastructure/redis-notification.sender.js";
import { RedisUserNotificationPublisher } from "../infrastructure/redis-user-notification.publisher.js";
import { createTransactionalMailer } from "../infrastructure/transactional-mailer.js";
import { WebPushSender } from "../infrastructure/web-push.sender.js";
import { WhatsappNotificationChannel } from "../infrastructure/whatsapp-notification.channel.js";
import { createBaseLogger } from "../lib/logger.js";
import { enqueueOrgSubmittedAdminNotice } from "../lib/org-lifecycle-notifications.js";
import { createRequireLegalEntityContext } from "../middleware/require-legal-entity-context.js";
import { ArtistRegistryService } from "../services/artist-registry.service.js";
import { AuthAuditPublisher } from "../services/auth-audit.publisher.js";
import { CachedCatalogueListService } from "../services/cached-catalogue-list.service.js";
import { DomainEventPublisher } from "../services/domain-event.publisher.js";
import { ImpersonationAuditService } from "../services/impersonation-audit.service.js";
import { ImpersonationSessionService } from "../services/impersonation-session.service.js";
import type { IArtistRegistryService } from "../services/interfaces/artist-registry.js";
import type { IInvitationLifecycleService } from "../services/interfaces/invitation-lifecycle.js";
import type { IMemberManagementService } from "../services/interfaces/member-management.js";
import type { IOrganizationOnboardingService } from "../services/interfaces/organization-onboarding.js";
import type { IPayoutService } from "../services/interfaces/payout.js";
import type { IPushSender } from "../services/interfaces/push.js";
import type { IStripeConnectService } from "../services/interfaces/stripe-connect.js";
import type { ITransactionalMailer } from "../services/interfaces/transactional-mail.js";
import { InvitationLifecycleService } from "../services/invitation-lifecycle.service.js";
import { InvoiceAddressingService } from "../services/invoice-addressing.js";
import { LegalEntityAccessService } from "../services/legal-entity-access.service.js";
import { LegalEntityLifecycleAdminService } from "../services/legal-entity-lifecycle-admin.service.js";
import { LotLifecycleEventRecorder } from "../services/lot-lifecycle-event-recorder.js";
import { LotLifecycleRecording } from "../services/lot-lifecycle-recording.service.js";
import { MemberManagementService } from "../services/member-management.service.js";
import { EmailMembershipInviteNotifier } from "../services/membership-invite-notifier.js";
import { NotificationOutboxProcessor } from "../services/notification-outbox.processor.js";
import { NotificationOutboxService } from "../services/notification-outbox.service.js";
import { NotificationDispatcher } from "../services/notification.dispatcher.js";
import { NotificationFactory } from "../services/notification.factory.js";
import { NotificationService } from "../services/notification.service.js";
import { OrganizationOnboardingService } from "../services/organization-onboarding.service.js";
import { OrganizationOnboardingFlowService } from "../services/organization-onboarding/organization-onboarding-flow.service.js";
import { PaymentRefundReconcileService } from "../services/payment/payment-refund-reconcile.service.js";
import { PayoutService } from "../services/payout.service.js";
import { PayoutAdjustmentService } from "../services/payout/payout-adjustment.service.js";
import { QuietHoursChecker } from "../services/quiet-hours.checker.js";
import { StripeConnectFacade } from "../services/stripe/stripe-connect.facade.js";
import { UiPreferenceService } from "../services/ui-preference.service.js";
import { LotStrategyFactory } from "../strategies/strategy.factory.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerPlatformServices = {
  domainEventPublisher: DomainEventPublisher;
  lotLifecycleEventRecorder: LotLifecycleEventRecorder;
  lotLifecycleRecording: LotLifecycleRecording;
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

export type CreatePlatformServicesInput = {
  env: Env;
  db: Database;
  infra: ContainerInfra;
  repos: ContainerRepositories;
};

export function createPlatformServices(
  input: CreatePlatformServicesInput,
): ContainerPlatformServices {
  const { env, db, infra, repos } = input;
  const { redis, cache, stripeClientFactory, emailService, legalEntityArchiveQueue } = infra;
  const {
    legalEntityRepository,
    repoFactory,
    payoutRepository,
    paymentRepo,
    paymentRefundReconcileRepository,
    uiPreferenceRepository,
    profileRepo,
    addressRepo,
    userSuspensionChecker,
    notificationWriteRepo,
    pushSubscriptionRepository,
    userRepo,
    notificationPreferenceRepository,
    notificationOutboxRepository,
  } = repos;

  const domainEventPublisher = new DomainEventPublisher();
  const lotLifecycleEventRecorder = new LotLifecycleEventRecorder(domainEventPublisher);
  const lotLifecycleRecording = new LotLifecycleRecording(lotLifecycleEventRecorder);
  const authAuditPublisher = new AuthAuditPublisher(domainEventPublisher);
  const organizationOnboardingService: IOrganizationOnboardingService =
    new OrganizationOnboardingService(db, domainEventPublisher);
  const impersonationAuditService = new ImpersonationAuditService(db, domainEventPublisher);
  const impersonationSessionService = new ImpersonationSessionService(db);
  const legalEntityAccessService = new LegalEntityAccessService(
    legalEntityRepository,
    impersonationSessionService,
    impersonationAuditService,
  );
  const requireLegalEntityContext = createRequireLegalEntityContext(legalEntityRepository, {
    impersonationSessions: impersonationSessionService,
    onImpersonationExpired: (input) => impersonationAuditService.recordSessionTimedOut(input),
  });
  const artistRegistryService: IArtistRegistryService = new ArtistRegistryService(
    db,
    domainEventPublisher,
  );
  const memberManagementService: IMemberManagementService = new MemberManagementService(
    db,
    domainEventPublisher,
    repoFactory,
  );
  const transactionalMailer: ITransactionalMailer = createTransactionalMailer(env);
  const membershipInviteNotifier = new EmailMembershipInviteNotifier(transactionalMailer);
  const invitationLifecycleService: IInvitationLifecycleService = new InvitationLifecycleService(
    db,
    domainEventPublisher,
    membershipInviteNotifier,
    env.WEB_ORIGIN,
  );
  const payoutAdjustmentService = new PayoutAdjustmentService(db, payoutRepository);
  const payoutService: IPayoutService = new PayoutService(
    payoutRepository,
    db,
    domainEventPublisher,
    payoutAdjustmentService,
  );
  const stripeConnectService: IStripeConnectService = new StripeConnectFacade(
    env,
    db,
    payoutService,
    payoutRepository,
    domainEventPublisher,
    stripeClientFactory,
    redis,
  );

  const organizationOnboardingFlowService = new OrganizationOnboardingFlowService(
    db,
    legalEntityRepository,
    organizationOnboardingService,
    domainEventPublisher,
    stripeConnectService,
    {
      onSubmittedForReview: async ({ legalEntityId, displayName }) => {
        const staffRows = await db
          .select({ email: user.email })
          .from(user)
          .where(and(eq(user.role, "staff"), isNull(user.suspendedAt)));
        const adminRecipients = staffRows.map((r) => r.email).filter(Boolean);
        if (adminRecipients.length === 0) return;
        const webOrigin = env.WEB_ORIGIN.replace(/\/$/, "");
        await enqueueOrgSubmittedAdminNotice({
          db,
          emailService,
          legalEntityId,
          entityDisplayName: displayName,
          adminRecipients,
          adminOnboardingUrl: `${webOrigin}/admin/onboarding-issues`,
          supportContactEmail: env.OPS_SUPPORT_EMAIL ?? "events@lax.bid",
          eventId: Date.now(),
        });
      },
    },
  );
  const legalEntityLifecycleAdminService = new LegalEntityLifecycleAdminService(
    db,
    domainEventPublisher,
    {
      enqueueArchiveCascade: async (legalEntityId: string) => {
        await legalEntityArchiveQueue.add(
          LEGAL_ENTITY_ARCHIVE_JOB_NAME,
          { legalEntityId },
          { removeOnComplete: 200, attempts: 3, backoff: { type: "exponential", delay: 2000 } },
        );
      },
      onApproveToConnectPending: async (legalEntityId: string) => {
        if (stripeConnectService.isConfigured()) {
          await stripeConnectService.syncAccountFromStripe(legalEntityId);
        }
      },
      emailService,
      webOrigin: env.WEB_ORIGIN,
      supportContactEmail: env.OPS_SUPPORT_EMAIL ?? "events@lax.bid",
    },
  );

  const paymentRefundReconcileService = new PaymentRefundReconcileService(
    db,
    paymentRepo,
    payoutAdjustmentService,
    domainEventPublisher,
    paymentRefundReconcileRepository,
  );
  const uiPreferenceService = new UiPreferenceService(uiPreferenceRepository);
  const invoiceAddressingService = new InvoiceAddressingService(
    paymentRepo,
    legalEntityRepository,
    profileRepo,
    addressRepo,
    createBaseLogger(env).child({ component: "invoice_addressing" }),
  );
  const cachedUserSuspensionChecker = new CachedUserSuspensionChecker(userSuspensionChecker, cache);
  const cachedCatalogueListService = new CachedCatalogueListService(cache, 20);
  const notifier = new RedisNotificationSender(redis);
  const userNotificationPublisher = new RedisUserNotificationPublisher(redis);
  const notificationService = new NotificationService(notifier, notifier);
  const strategyFactory = new LotStrategyFactory();
  const notificationFactory = new NotificationFactory();

  const quietHoursChecker = new QuietHoursChecker();
  const pushSender: IPushSender =
    env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT
      ? new WebPushSender(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT)
      : new NoOpPushSender();

  const inAppChannel = new InAppNotificationChannel(
    notificationWriteRepo,
    userNotificationPublisher,
    cache,
  );
  const pushChannel = new PushNotificationChannel(pushSender, pushSubscriptionRepository);
  const emailChannel = new EmailNotificationChannel(
    emailService,
    userRepo,
    env.WEB_ORIGIN,
    env.EMAIL_UNSUBSCRIBE_SECRET,
  );
  const channels = env.ENABLE_WHATSAPP_CHANNEL
    ? [inAppChannel, pushChannel, emailChannel, new WhatsappNotificationChannel()]
    : [inAppChannel, pushChannel, emailChannel];
  const notificationDispatcher = new NotificationDispatcher(
    channels,
    notificationPreferenceRepository,
    quietHoursChecker,
  );
  const notificationOutboxService = new NotificationOutboxService(notificationOutboxRepository);
  const notificationOutboxProcessor = new NotificationOutboxProcessor(
    notificationOutboxRepository,
    notificationDispatcher,
  );

  return {
    domainEventPublisher,
    lotLifecycleEventRecorder,
    lotLifecycleRecording,
    authAuditPublisher,
    organizationOnboardingService,
    impersonationAuditService,
    impersonationSessionService,
    legalEntityAccessService,
    requireLegalEntityContext,
    artistRegistryService,
    memberManagementService,
    transactionalMailer,
    invitationLifecycleService,
    payoutAdjustmentService,
    payoutService,
    stripeConnectService,
    organizationOnboardingFlowService,
    legalEntityLifecycleAdminService,
    paymentRefundReconcileService,
    uiPreferenceService,
    invoiceAddressingService,
    cachedUserSuspensionChecker,
    cachedCatalogueListService,
    userNotificationPublisher,
    notificationService,
    strategyFactory,
    notificationFactory,
    notificationDispatcher,
    notificationOutboxService,
    notificationOutboxProcessor,
  };
}
