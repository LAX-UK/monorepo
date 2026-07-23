import type {
  IAdminFinanceIssueSnapshotReader,
  IAdminLegalEntityBrowseReader,
  IAdminOnboardingIssuesReader,
  IAdminUserReader,
  IImpersonationDomainEventReader,
  IImpersonationSessionRepository,
  ILegalEntityRepository,
  ITransactionRunner,
  IUserInvitationRepository,
} from "@auction/persistence/interfaces";
import type { AdminUserService } from "../admin-user.service.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { AdminPeopleRouteServices } from "../interfaces/admin-routes/admin-people-routes.js";
import type { InvitationService } from "../invitation.service.js";
import type { ProfileService } from "../profile.service.js";
import { AdminImpersonationService } from "./admin-impersonation.service.js";
import { AdminInvitationApplicationService } from "./admin-invitation-application.service.js";
import { AdminLegalEntityBrowseQueryService } from "./admin-legal-entity-browse-query.service.js";
import { AdminOnboardingIssuesQueryService } from "./admin-onboarding-issues-query.service.js";
import { AdminUserApplicationService } from "./admin-user-application.service.js";

export type CreateAdminPeopleServicesInput = {
  transactionRunner: ITransactionRunner;
  domainEventSink: IDomainEventSink;
  impersonationSessionRepository: IImpersonationSessionRepository;
  impersonationDomainEventReader: IImpersonationDomainEventReader;
  legalEntityRepository: ILegalEntityRepository;
  adminUserService: AdminUserService;
  adminUserReader: IAdminUserReader;
  profileService: ProfileService;
  invitationService: InvitationService;
  invitationRepository: IUserInvitationRepository;
  adminLegalEntityBrowseReader: IAdminLegalEntityBrowseReader;
  adminOnboardingIssuesReader: IAdminOnboardingIssuesReader;
  adminFinanceIssueSnapshotReader: IAdminFinanceIssueSnapshotReader;
};

export function createAdminPeopleServices(
  input: CreateAdminPeopleServicesInput,
): AdminPeopleRouteServices {
  return {
    impersonation: new AdminImpersonationService(
      input.transactionRunner,
      input.legalEntityRepository,
      input.impersonationSessionRepository,
      input.impersonationDomainEventReader,
      input.domainEventSink,
    ),
    users: new AdminUserApplicationService(
      input.adminUserService,
      input.profileService,
      input.adminUserReader,
    ),
    invitations: new AdminInvitationApplicationService(
      input.invitationService,
      input.invitationRepository,
    ),
    legalEntityBrowse: new AdminLegalEntityBrowseQueryService(input.adminLegalEntityBrowseReader),
    onboardingIssues: new AdminOnboardingIssuesQueryService(input.adminOnboardingIssuesReader),
    stripeConnectRequirements: {
      listEntities: () =>
        input.adminFinanceIssueSnapshotReader.listStripeConnectRequirementEntities(),
    },
  };
}
