import type { Database } from "@auction/db";
import type {
  IAccountDeletionEligibilityReader,
  IAddressRepository,
  ICategoryInterestsEligibilityReader,
  ICategoryInterestsRepository,
  IEntityInvitationRepository,
  IImpersonationDomainEventReader,
  IImpersonationSessionRepository,
  IKycRepository,
  ILegalEntityConnectReader,
  ILegalEntityConnectRepository,
  ILegalEntityMemberRepository,
  ILegalEntityNotificationRecipientReader,
  ILegalEntityOnboardingRepository,
  ILegalEntityRepository,
  INewsletterSignupRepository,
  INotificationPreferenceRepository,
  IPendingInvitationsReader,
  IProfileReader,
  IProfileWriter,
  IPushSubscriptionRepository,
  ISavedSearchRepository,
  IUiPreferenceRepository,
  IUserInvitationRepository,
  IUserRepository,
  IUserSuspensionChecker,
} from "@auction/persistence/interfaces";
import {
  DrizzleAccountDeletionEligibilityReader,
  DrizzleAddressRepository,
  DrizzleCategoryInterestsEligibilityReader,
  DrizzleCategoryInterestsRepository,
  DrizzleEntityInvitationRepository,
  DrizzleImpersonationDomainEventReader,
  DrizzleImpersonationSessionRepository,
  DrizzleKycRepository,
  DrizzleLegalEntityConnectRepository,
  DrizzleLegalEntityMemberRepository,
  DrizzleLegalEntityNotificationRecipientRepository,
  DrizzleLegalEntityOnboardingRepository,
  DrizzleNewsletterSignupRepository,
  DrizzleNotificationPreferenceRepository,
  DrizzlePendingInvitationsReader,
  DrizzleProfileRepository,
  DrizzlePushSubscriptionRepository,
  DrizzleSavedSearchRepository,
  DrizzleUiPreferenceRepository,
  DrizzleUserInvitationRepository,
  DrizzleUserRepository,
  DrizzleUserSuspensionChecker,
  createDrizzleLegalEntityRepository,
} from "@auction/persistence/repositories";

export type IProfileRepository = IProfileReader & IProfileWriter;

export type IdentityRepositories = {
  userRepo: IUserRepository;
  profileRepo: IProfileRepository;
  addressRepo: IAddressRepository;
  categoryInterestsEligibilityReader: ICategoryInterestsEligibilityReader;
  categoryInterestsRepository: ICategoryInterestsRepository;
  legalEntityRepository: ILegalEntityRepository;
  legalEntityOnboardingRepository: ILegalEntityOnboardingRepository;
  legalEntityConnectRepository: ILegalEntityConnectRepository;
  legalEntityConnectReader: ILegalEntityConnectReader;
  legalEntityNotificationRecipients: ILegalEntityNotificationRecipientReader;
  legalEntityMemberRepository: ILegalEntityMemberRepository;
  kycRepository: IKycRepository;
  pendingInvitationsReader: IPendingInvitationsReader;
  invitationRepository: IUserInvitationRepository;
  entityInvitationRepository: IEntityInvitationRepository;
  notificationPreferenceRepository: INotificationPreferenceRepository;
  uiPreferenceRepository: IUiPreferenceRepository;
  pushSubscriptionRepository: IPushSubscriptionRepository;
  impersonationSessionRepository: IImpersonationSessionRepository;
  impersonationDomainEventReader: IImpersonationDomainEventReader;
  userSuspensionChecker: IUserSuspensionChecker;
  accountDeletionEligibilityReader: IAccountDeletionEligibilityReader;
  savedSearchRepository: ISavedSearchRepository;
  newsletterSignupRepository: INewsletterSignupRepository;
};

export function createIdentityRepositories(db: Database): IdentityRepositories {
  const userRepo = new DrizzleUserRepository(db);
  const profileRepo = new DrizzleProfileRepository(db);
  const addressRepo = new DrizzleAddressRepository(db);
  const categoryInterestsEligibilityReader = new DrizzleCategoryInterestsEligibilityReader(db);
  const categoryInterestsRepository = new DrizzleCategoryInterestsRepository(db);
  const legalEntityRepository = createDrizzleLegalEntityRepository(db);
  const legalEntityOnboardingRepository = new DrizzleLegalEntityOnboardingRepository(db);
  const legalEntityConnectRepository = new DrizzleLegalEntityConnectRepository(db);
  const legalEntityConnectReader = legalEntityConnectRepository;
  const legalEntityNotificationRecipients: ILegalEntityNotificationRecipientReader =
    new DrizzleLegalEntityNotificationRecipientRepository(db);
  const legalEntityMemberRepository = new DrizzleLegalEntityMemberRepository(db);
  const kycRepository = new DrizzleKycRepository(db);
  const pendingInvitationsReader: IPendingInvitationsReader = new DrizzlePendingInvitationsReader(
    db,
  );
  const invitationRepository = new DrizzleUserInvitationRepository(db);
  const entityInvitationRepository = new DrizzleEntityInvitationRepository(db);
  const notificationPreferenceRepository = new DrizzleNotificationPreferenceRepository(db);
  const uiPreferenceRepository = new DrizzleUiPreferenceRepository(db);
  const pushSubscriptionRepository = new DrizzlePushSubscriptionRepository(db);
  const impersonationSessionRepository = new DrizzleImpersonationSessionRepository(db);
  const impersonationDomainEventReader = new DrizzleImpersonationDomainEventReader(db);
  const userSuspensionChecker = new DrizzleUserSuspensionChecker(db);
  const accountDeletionEligibilityReader = new DrizzleAccountDeletionEligibilityReader(db);
  const savedSearchRepository = new DrizzleSavedSearchRepository(db);
  const newsletterSignupRepository = new DrizzleNewsletterSignupRepository(db);

  return {
    userRepo,
    profileRepo,
    addressRepo,
    categoryInterestsEligibilityReader,
    categoryInterestsRepository,
    legalEntityRepository,
    legalEntityOnboardingRepository,
    legalEntityConnectRepository,
    legalEntityConnectReader,
    legalEntityNotificationRecipients,
    legalEntityMemberRepository,
    kycRepository,
    pendingInvitationsReader,
    invitationRepository,
    entityInvitationRepository,
    notificationPreferenceRepository,
    uiPreferenceRepository,
    pushSubscriptionRepository,
    impersonationSessionRepository,
    impersonationDomainEventReader,
    userSuspensionChecker,
    accountDeletionEligibilityReader,
    savedSearchRepository,
    newsletterSignupRepository,
  };
}
