import type { Database } from "@auction/db";
import type { IUserInvitationRepository } from "@auction/persistence/interfaces";
import type { Env } from "../env.js";
import { IdentityIssuerEmailSignupPersister } from "../infrastructure/identity-issuer-email-signup.persister.js";
import { IdentityIssuerVerificationEmailResender } from "../infrastructure/identity-issuer-verification-email.resender.js";
import { IdentityRegistrationCompensator } from "../infrastructure/identity-registration.compensator.js";
import { NoOpWelcomeNotifier } from "../infrastructure/no-op-welcome.notifier.js";
import { DrizzleUserProfilePersister } from "../infrastructure/user-profile.persister.js";
import { ZodRegistrationValidator } from "../infrastructure/zod-registration.validator.js";
import { type OrgModuleGate, createOrgModuleGate } from "../lib/org-module-gate.js";
import { createSubmissionsLegalEntityContext } from "../middleware/require-legal-entity-context.js";
import { AddressService } from "../services/address.service.js";
import { AdminUserService } from "../services/admin-user.service.js";
import { ArtistWatchlistService } from "../services/artist-watchlist.service.js";
import type {
  IIdentityIssuerClient,
  IIdentityProfileClient,
  IIdentitySecurityClient,
  IIdentitySubjectClient,
} from "../services/interfaces/identity-issuer-client.js";
import { InvitationConsumptionService } from "../services/invitation-consumption.service.js";
import { InvitationService } from "../services/invitation.service.js";
import type { EnsurePersonalLegalEntityService } from "../services/legal-entity/ensure-personal-legal-entity.service.js";
import { PersonalLegalEntityResolver } from "../services/legal-entity/personal-legal-entity-resolver.service.js";
import { ProfileService } from "../services/profile.service.js";
import { RegistrationService } from "../services/registration.service.js";
import { SavedSearchService } from "../services/saved-search.service.js";
import { UserDashboardReadService } from "../services/user-dashboard-read.service.js";
import { UserSecurityReadService } from "../services/user-security-read.service.js";
import { UserService } from "../services/user.service.js";
import { WatchlistService } from "../services/watchlist.service.js";
import { DrizzleAdminUserSuspender } from "./adapters/drizzle-admin-user-suspender.js";
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
  invitationRepository: IUserInvitationRepository;
  registrationService: RegistrationService;
  orgModuleGate: OrgModuleGate;
  adminUserService: AdminUserService;
};

export type CreateUserProfileServicesInput = {
  env: Env;
  db: Database;
  identityIssuer: IIdentityIssuerClient &
    IIdentitySubjectClient &
    IIdentityProfileClient &
    IIdentitySecurityClient;
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
    identityIssuer,
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
    impersonationSessionService,
    impersonationAuditService,
    authAuditPublisher,
    cachedUserSuspensionChecker,
  } = platform;
  const { marketingEventService, mediaUrlResolver, mediaAssetEnricher, imageCleanupService } =
    complianceMedia;
  const { dashboardQueryService, saleService, artistProfileService } = catalog;

  const userService = new UserService(userRepo, identityIssuer);
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
  const profileService = new ProfileService(
    profileRepo,
    {
      updateProfile: async (userId, update) => {
        if (update.name !== undefined || update.image !== undefined) {
          await identityIssuer.updateSubjectProfile(userId, {
            ...(update.name !== undefined ? { name: update.name } : {}),
            ...(update.image !== undefined ? { image: update.image } : {}),
          });
        }
        await profileRepo.updateProfile(userId, {
          ...(update.mobile !== undefined ? { mobile: update.mobile } : {}),
          ...(update.mobileCountry !== undefined ? { mobileCountry: update.mobileCountry } : {}),
        });
      },
    },
    imageCleanupService,
    identityIssuer,
  );
  const userSecurityReadService = new UserSecurityReadService(identityIssuer);
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
    identityIssuer,
    new IdentityIssuerVerificationEmailResender(identityIssuer, env.WEB_ORIGIN),
    new IdentityIssuerEmailSignupPersister(identityIssuer, env.WEB_ORIGIN),
    new DrizzleUserProfilePersister(db),
    new NoOpWelcomeNotifier(),
    invitationConsumptionService,
    new IdentityRegistrationCompensator(identityIssuer),
  );

  const orgModuleGate = createOrgModuleGate(env.WEB_ORIGIN);

  const adminSuspender = new DrizzleAdminUserSuspender(db, {
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
    identityIssuer,
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
    invitationRepository,
    registrationService,
    orgModuleGate,
    adminUserService,
  };
}
