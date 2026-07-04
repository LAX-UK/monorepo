import type { IImpersonationSessionRepository } from "@auction/persistence/interfaces";
import type { IImpersonationDomainEventReader } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { AdminUserService } from "../admin-user.service.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { AdminPeopleRouteServices } from "../interfaces/admin-routes/admin-people-routes.js";
import type { InvitationService } from "../invitation.service.js";
import type { ProfileService } from "../profile.service.js";
import { AdminImpersonationService } from "./admin-impersonation.service.js";
import { AdminInvitationApplicationService } from "./admin-invitation-application.service.js";
import { AdminUserApplicationService } from "./admin-user-application.service.js";

export type CreateAdminPeopleServicesInput = {
  transactionRunner: import("@auction/persistence/interfaces").ITransactionRunner;
  domainEventSink: IDomainEventSink;
  impersonationSessionRepository: IImpersonationSessionRepository;
  impersonationDomainEventReader: IImpersonationDomainEventReader;
  legalEntityRepository: ILegalEntityRepository;
  adminUserService: AdminUserService;
  profileService: ProfileService;
  invitationService: InvitationService;
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
    users: new AdminUserApplicationService(input.adminUserService, input.profileService),
    invitations: new AdminInvitationApplicationService(input.invitationService),
  };
}
