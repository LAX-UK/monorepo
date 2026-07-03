import type { Database } from "@auction/db";
import { LEGAL_ENTITY_ARCHIVE_JOB_NAME } from "@auction/queues";
import type { Env } from "../env.js";
import { CachedUserSuspensionChecker } from "../infrastructure/cached-user-suspension.checker.js";
import { createTransactionalMailer } from "../infrastructure/transactional-mailer.js";
import { enqueueOrgSubmittedAdminNotice } from "../lib/org-lifecycle-notifications.js";
import { createRequireLegalEntityContext } from "../middleware/require-legal-entity-context.js";
import { ArtistRegistryService } from "../services/artist-registry.service.js";
import { CachedCatalogueListService } from "../services/cached-catalogue-list.service.js";
import { ImpersonationAuditService } from "../services/impersonation-audit.service.js";
import { ImpersonationSessionService } from "../services/impersonation-session.service.js";
import type { IArtistRegistryService } from "../services/interfaces/artist-registry.js";
import type { IInvitationLifecycleService } from "../services/interfaces/invitation-lifecycle.js";
import type { IMemberManagementService } from "../services/interfaces/member-management.js";
import type { IOrganizationOnboardingService } from "../services/interfaces/organization-onboarding.js";
import type { IStripeConnectService } from "../services/interfaces/stripe-connect.js";
import type { ITransactionalMailer } from "../services/interfaces/transactional-mail.js";
import { InvitationLifecycleService } from "../services/invitation-lifecycle.service.js";
import { LegalEntityAccessService } from "../services/legal-entity-access.service.js";
import { LegalEntityLifecycleAdminService } from "../services/legal-entity-lifecycle-admin.service.js";
import { LegalEntityMembershipGuard } from "../services/legal-entity-membership.guard.js";
import { MemberManagementService } from "../services/member-management.service.js";
import { EmailMembershipInviteNotifier } from "../services/membership-invite-notifier.js";
import { OrganizationOnboardingService } from "../services/organization-onboarding.service.js";
import { OrganizationOnboardingFlowService } from "../services/organization-onboarding/organization-onboarding-flow.service.js";
import { UiPreferenceService } from "../services/ui-preference.service.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerPlatformCore } from "./create-platform-core.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerPlatformIdentityServices = {
  organizationOnboardingService: IOrganizationOnboardingService;
  impersonationAuditService: ImpersonationAuditService;
  impersonationSessionService: ImpersonationSessionService;
  legalEntityAccessService: LegalEntityAccessService;
  requireLegalEntityContext: ReturnType<typeof createRequireLegalEntityContext>;
  artistRegistryService: IArtistRegistryService;
  memberManagementService: IMemberManagementService;
  transactionalMailer: ITransactionalMailer;
  invitationLifecycleService: IInvitationLifecycleService;
  organizationOnboardingFlowService: OrganizationOnboardingFlowService;
  legalEntityLifecycleAdminService: LegalEntityLifecycleAdminService;
  uiPreferenceService: UiPreferenceService;
  cachedUserSuspensionChecker: CachedUserSuspensionChecker;
  cachedCatalogueListService: CachedCatalogueListService;
};

export type CreatePlatformIdentityServicesInput = {
  env: Env;
  db: Database;
  infra: ContainerInfra;
  repos: ContainerRepositories;
  core: ContainerPlatformCore;
  stripeConnectService: IStripeConnectService;
};

export function createPlatformIdentityServices(
  input: CreatePlatformIdentityServicesInput,
): ContainerPlatformIdentityServices {
  const { env, infra, repos, core, stripeConnectService } = input;
  const { cache, emailService, legalEntityArchiveQueue } = infra;
  const {
    legalEntityRepository,
    legalEntityOnboardingRepository,
    repoFactory,
    uiPreferenceRepository,
    userSuspensionChecker,
    artistRegistryRepository,
    entityInvitationRepository,
    uploadPersistenceRepository,
  } = repos;
  const { domainEventPublisher } = core;

  const organizationOnboardingService: IOrganizationOnboardingService =
    new OrganizationOnboardingService(legalEntityOnboardingRepository, domainEventPublisher);
  const impersonationAuditService = new ImpersonationAuditService(
    core.transactionRunner,
    repos.impersonationDomainEventReader,
    domainEventPublisher,
  );
  const impersonationSessionService = new ImpersonationSessionService(
    repos.impersonationSessionRepository,
  );
  const legalEntityAccessService = new LegalEntityAccessService(
    legalEntityRepository,
    impersonationSessionService,
    impersonationAuditService,
  );
  const requireLegalEntityContext = createRequireLegalEntityContext(legalEntityRepository, {
    impersonationSessions: impersonationSessionService,
    onImpersonationExpired: (impersonationInput) =>
      impersonationAuditService.recordSessionTimedOut(impersonationInput),
  });
  const artistRegistryService: IArtistRegistryService = new ArtistRegistryService(
    artistRegistryRepository,
    domainEventPublisher,
  );
  const memberManagementService: IMemberManagementService = new MemberManagementService(
    core.transactionRunner,
    repos.legalEntityMemberRepository,
    core.domainEventSink,
    repoFactory,
  );
  const transactionalMailer: ITransactionalMailer = createTransactionalMailer(env);
  const membershipInviteNotifier = new EmailMembershipInviteNotifier(transactionalMailer);
  const membershipGuard = new LegalEntityMembershipGuard(repos.legalEntityMemberRepository);
  const invitationLifecycleService: IInvitationLifecycleService = new InvitationLifecycleService(
    core.transactionRunner,
    entityInvitationRepository,
    domainEventPublisher,
    membershipInviteNotifier,
    env.WEB_ORIGIN,
    membershipGuard,
  );
  const organizationOnboardingFlowService = new OrganizationOnboardingFlowService(
    core.transactionRunner,
    legalEntityRepository,
    organizationOnboardingService,
    domainEventPublisher,
    uploadPersistenceRepository,
    legalEntityOnboardingRepository,
    stripeConnectService,
    {
      onSubmittedForReview: async ({ legalEntityId, displayName }) => {
        const adminRecipients = await repos.userRepo.listStaffEmails();
        if (adminRecipients.length === 0) return;
        const webOrigin = env.WEB_ORIGIN.replace(/\/$/, "");
        await enqueueOrgSubmittedAdminNotice({
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
    core.transactionRunner,
    repos.legalEntityLifecycleAdminRepository,
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
      legalEntityRepository,
      memberRepository: repos.legalEntityMemberRepository,
      webOrigin: env.WEB_ORIGIN,
      supportContactEmail: env.OPS_SUPPORT_EMAIL ?? "events@lax.bid",
    },
  );
  const uiPreferenceService = new UiPreferenceService(uiPreferenceRepository);
  const cachedUserSuspensionChecker = new CachedUserSuspensionChecker(userSuspensionChecker, cache);
  const cachedCatalogueListService = new CachedCatalogueListService(cache, 20);

  return {
    organizationOnboardingService,
    impersonationAuditService,
    impersonationSessionService,
    legalEntityAccessService,
    requireLegalEntityContext,
    artistRegistryService,
    memberManagementService,
    transactionalMailer,
    invitationLifecycleService,
    organizationOnboardingFlowService,
    legalEntityLifecycleAdminService,
    uiPreferenceService,
    cachedUserSuspensionChecker,
    cachedCatalogueListService,
  };
}
