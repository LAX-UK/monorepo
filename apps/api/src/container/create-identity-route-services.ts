import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { IPendingInvitationsReader } from "@auction/persistence/interfaces";
import type { OrgModuleGate } from "../lib/org-module-gate.js";
import { IdentityAccountSecurityHttpApplicationService } from "../services/identity/identity-account-security-http-application.service.js";
import type { IdentityAccountSecurityDeps } from "../services/identity/identity-account-security-http-application.service.js";
import { IdentityLegalEntityHttpApplicationService } from "../services/identity/identity-legal-entity-http-application.service.js";
import { IdentityLegalEntityMemberHttpApplicationService } from "../services/identity/identity-legal-entity-member-http-application.service.js";
import { IdentityOrganizationHttpApplicationService } from "../services/identity/identity-organization-http-application.service.js";
import { IdentityOrganizationOnboardingHttpApplicationService } from "../services/identity/identity-organization-onboarding-http-application.service.js";
import type { IdentityRouteServices } from "../services/interfaces/identity-routes/index.js";
import type { IInvitationLifecycleService } from "../services/interfaces/invitation-lifecycle.js";
import type { IMemberManagementService } from "../services/interfaces/member-management.js";
import type { IOrganizationOnboardingService } from "../services/interfaces/organization-onboarding.js";
import type { LegalEntityAccessService } from "../services/legal-entity-access.service.js";
import type { PersonalLegalEntityResolver } from "../services/legal-entity/personal-legal-entity-resolver.service.js";
import type { IOrganizationOnboardingFlowService } from "../services/organization-onboarding/onboarding-context.js";
import type { UserService } from "../services/user.service.js";

export type CreateIdentityRouteServicesInput = {
  accountSecurity: IdentityAccountSecurityDeps;
  legalEntityRepository: ILegalEntityRepository;
  personalLegalEntityResolver: PersonalLegalEntityResolver;
  orgModuleGate: OrgModuleGate;
  userService: UserService;
  pendingInvitationsReader: IPendingInvitationsReader;
  invitationLifecycleService: IInvitationLifecycleService;
  legalEntityAccessService: LegalEntityAccessService;
  memberManagementService: IMemberManagementService;
  organizationOnboardingService: IOrganizationOnboardingService;
  organizationOnboardingFlowService: IOrganizationOnboardingFlowService;
};

export function createIdentityRouteServices(
  input: CreateIdentityRouteServicesInput,
): IdentityRouteServices {
  return {
    accountSecurityHttp: new IdentityAccountSecurityHttpApplicationService(input.accountSecurity),
    legalEntityHttp: new IdentityLegalEntityHttpApplicationService(
      input.legalEntityRepository,
      input.personalLegalEntityResolver,
      input.orgModuleGate,
      input.userService,
      input.pendingInvitationsReader,
      input.invitationLifecycleService,
      input.legalEntityAccessService,
    ),
    legalEntityMemberHttp: new IdentityLegalEntityMemberHttpApplicationService(
      input.memberManagementService,
      input.invitationLifecycleService,
      input.orgModuleGate,
      input.userService,
    ),
    organizationHttp: new IdentityOrganizationHttpApplicationService(
      input.organizationOnboardingService,
      input.orgModuleGate,
    ),
    organizationOnboardingHttp: new IdentityOrganizationOnboardingHttpApplicationService(
      input.organizationOnboardingFlowService,
    ),
  };
}
