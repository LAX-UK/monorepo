import type { Auth } from "@auction/auth/server";
import type { Database } from "@auction/db";
import type { Env } from "../env.js";
import { BetterAuthEmailSignupPersister } from "../infrastructure/better-auth-email-signup.persister.js";
import { BetterAuthVerificationEmailResender } from "../infrastructure/better-auth-verification-email.resender.js";
import { DrizzleExistingAccountReader } from "../infrastructure/drizzle-existing-account.reader.js";
import { DrizzleRegistrationCompensator } from "../infrastructure/drizzle-registration.compensator.js";
import { NoOpWelcomeNotifier } from "../infrastructure/no-op-welcome.notifier.js";
import { DrizzleUserProfilePersister } from "../infrastructure/user-profile.persister.js";
import { ZodRegistrationValidator } from "../infrastructure/zod-registration.validator.js";
import { type OrgModuleGate, createOrgModuleGate } from "../lib/org-module-gate.js";
import { createSubmissionsLegalEntityContext } from "../middleware/require-legal-entity-context.js";
import { DrizzleAdminUserSuspender } from "../repositories/drizzle-admin-user-suspender.js";
import { AddressService } from "../services/address.service.js";
import { AdminUserService } from "../services/admin-user.service.js";
import { ArtistWatchlistService } from "../services/artist-watchlist.service.js";
import { InvitationConsumptionService } from "../services/invitation-consumption.service.js";
import { InvitationService } from "../services/invitation.service.js";
import type { EnsurePersonalLegalEntityService } from "../services/legal-entity/ensure-personal-legal-entity.service.js";
import { PersonalLegalEntityResolver } from "../services/legal-entity/personal-legal-entity-resolver.service.js";
import { ProfileService } from "../services/profile.service.js";
import { RegistrationService } from "../services/registration.service.js";
import { SavedSearchService } from "../services/saved-search.service.js";
import type { SessionRevocationService } from "../services/session-revocation.service.js";
import { UserDashboardReadService } from "../services/user-dashboard-read.service.js";
import { UserSecurityReadService } from "../services/user-security-read.service.js";
import { UserService } from "../services/user.service.js";
import { WatchlistService } from "../services/watchlist.service.js";
import type { ContainerCatalogServices } from "./create-catalog-services.js";
import type { ContainerComplianceMedia } from "./create-compliance-media.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerUserProfileServices = {
  userService: UserService;
  personalLegalEntityResolver: PersonalLegalEntityResolver;
  requireSubmissionsLegalEntityContext: ReturnType<typeof createSubmissionsLegalEntityContext>;
  watchlistService: WatchlistService;
  userDashboardReadService: UserDashboardReadService;
  userSecurityReadService: UserSecurityReadService;
  savedSearchService: SavedSearchService;
  artistWatchlistService: ArtistWatchlistService;
  profileService: ProfileService;
  addressService: AddressService;
  invitationService: InvitationService;
  registrationService: RegistrationService;
  orgModuleGate: OrgModuleGate;
  adminUserService: AdminUserService;
};

export type CreateUserProfileServicesInput = {
  env: Env;
  db: Database;
  authDb: Database;
  auth: Auth;
  sessionRevocation: SessionRevocationService;
  ensurePersonalLegalEntityService: EnsurePersonalLegalEntityService;
  infra: ContainerInfra;
  repos: ContainerRepositories;
  platform: ContainerPlatformServices;
  complianceMedia: ContainerComplianceMedia;
  catalog: ContainerCatalogServices;
};

export function createUserProfileServices(
  input: CreateUserProfileServicesInput,
): ContainerUserProfileServices {
  const {
    env,
    db,
    authDb,
    auth,
    sessionRevocation,
    ensurePersonalLegalEntityService,
    infra,
    repos,
    platform,
    complianceMedia,
    catalog,
  } = input;
  const { emailService } = infra;
  const {
    userRepo,
    legalEntityRepository,
    watchlistRepo,
    lotRepo,
    artistWatchlistRepo,
    profileRepo,
    addressRepo,
    invitationRepository,
    adminUserReader,
    adminRoleManager,
    adminActivityReader,
    adminUserBidsReader,
    adminUserKycReader,
    savedSearchRepository,
  } = repos;
  const {
    domainEventPublisher,
    impersonationSessionService,
    impersonationAuditService,
    authAuditPublisher,
    cachedUserSuspensionChecker,
  } = platform;
  const { marketingEventService, mediaUrlResolver, mediaAssetEnricher, imageCleanupService } =
    complianceMedia;
  const { dashboardQueryService, saleService, artistProfileService } = catalog;

  const userService = new UserService(userRepo, platform.transactionRunner, domainEventPublisher);
  const personalLegalEntityResolver = new PersonalLegalEntityResolver(
    legalEntityRepository,
    ensurePersonalLegalEntityService,
    userService,
  );
  const requireSubmissionsLegalEntityContext = createSubmissionsLegalEntityContext(
    legalEntityRepository,
    {
      impersonationSessions: impersonationSessionService,
      onImpersonationExpired: (input) => impersonationAuditService.recordSessionTimedOut(input),
      resolvePersonalEntity: (userId) => personalLegalEntityResolver.resolveForUser(userId),
    },
  );
  const watchlistService = new WatchlistService(
    watchlistRepo,
    lotRepo,
    platform.transactionRunner,
    marketingEventService,
  );
  const userDashboardReadService = new UserDashboardReadService(
    dashboardQueryService,
    watchlistService,
    mediaUrlResolver,
    saleService,
    mediaAssetEnricher,
  );
  const savedSearchService = new SavedSearchService(savedSearchRepository);
  const artistWatchlistService = new ArtistWatchlistService(artistWatchlistRepo, {
    findById: async (id: string) => {
      const a = await artistProfileService.getById(id);
      return a ? { id: a.id } : null;
    },
  });
  const profileService = new ProfileService(profileRepo, profileRepo, imageCleanupService);
  const userSecurityReadService = new UserSecurityReadService(profileRepo);
  const addressService = new AddressService(addressRepo);

  const invitationService = new InvitationService(
    invitationRepository,
    userRepo,
    emailService,
    env.WEB_ORIGIN,
  );
  const invitationConsumptionService = new InvitationConsumptionService(invitationRepository);

  const registrationService = new RegistrationService(
    new ZodRegistrationValidator(),
    new DrizzleExistingAccountReader(db),
    new BetterAuthVerificationEmailResender(auth, env.WEB_ORIGIN),
    new BetterAuthEmailSignupPersister(auth, env.WEB_ORIGIN),
    new DrizzleUserProfilePersister(db),
    new NoOpWelcomeNotifier(),
    invitationConsumptionService,
    new DrizzleRegistrationCompensator(authDb),
  );

  const orgModuleGate = createOrgModuleGate(env.WEB_ORIGIN);

  const adminSuspender = new DrizzleAdminUserSuspender(db, sessionRevocation, {
    emailService,
    authAudit: authAuditPublisher,
    accountSuspendedSupportEmail: env.EMAIL_REPLY_TO?.trim() || "support@lax.bid",
  });
  const adminUserService = new AdminUserService(
    adminUserReader,
    adminRoleManager,
    adminSuspender,
    adminActivityReader,
    adminUserBidsReader,
    adminUserKycReader,
    cachedUserSuspensionChecker,
  );

  return {
    userService,
    personalLegalEntityResolver,
    requireSubmissionsLegalEntityContext,
    watchlistService,
    userDashboardReadService,
    userSecurityReadService,
    savedSearchService,
    artistWatchlistService,
    profileService,
    addressService,
    invitationService,
    registrationService,
    orgModuleGate,
    adminUserService,
  };
}
