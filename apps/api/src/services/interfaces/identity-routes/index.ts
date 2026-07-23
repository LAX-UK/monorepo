import type { IIdentityAccountSecurityHttpApplicationService } from "./identity-account-security-http.js";
import type { IIdentityLegalEntityHttpApplicationService } from "./identity-legal-entity-http.js";
import type { IIdentityLegalEntityMemberHttpApplicationService } from "./identity-legal-entity-member-http.js";
import type { IIdentityOrganizationHttpApplicationService } from "./identity-organization-http.js";
import type { IIdentityOrganizationOnboardingHttpApplicationService } from "./identity-organization-onboarding-http.js";

export type IdentityRouteServices = {
  accountSecurityHttp: IIdentityAccountSecurityHttpApplicationService;
  legalEntityHttp: IIdentityLegalEntityHttpApplicationService;
  legalEntityMemberHttp: IIdentityLegalEntityMemberHttpApplicationService;
  organizationHttp: IIdentityOrganizationHttpApplicationService;
  organizationOnboardingHttp: IIdentityOrganizationOnboardingHttpApplicationService;
};

export type {
  IIdentityAccountSecurityHttpApplicationService,
  IIdentityLegalEntityHttpApplicationService,
  IIdentityLegalEntityMemberHttpApplicationService,
  IIdentityOrganizationHttpApplicationService,
  IIdentityOrganizationOnboardingHttpApplicationService,
};
