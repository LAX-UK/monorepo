import type { RecordAccountService } from "../../legal-entity/record-account.service.js";
import type { RememberedAccountService } from "../../legal-entity/remembered-account.service.js";
import type { TwoFactorPolicyService } from "../../security/two-factor-policy.service.js";
import type { IIdentityAccountSecurityHttpApplicationService } from "./identity-account-security-http.js";
import type { IIdentityLegalEntityHttpApplicationService } from "./identity-legal-entity-http.js";
import type { IIdentityLegalEntityMemberHttpApplicationService } from "./identity-legal-entity-member-http.js";
import type { IIdentityOrganizationHttpApplicationService } from "./identity-organization-http.js";
import type { IIdentityOrganizationOnboardingHttpApplicationService } from "./identity-organization-onboarding-http.js";

export type IOrgTwoFactorPolicyHttp = Pick<
  TwoFactorPolicyService,
  "readOrgPolicy" | "setOrgPolicy"
>;

export type IdentityRouteServices = {
  accountSecurityHttp: IIdentityAccountSecurityHttpApplicationService;
  legalEntityHttp: IIdentityLegalEntityHttpApplicationService;
  legalEntityMemberHttp: IIdentityLegalEntityMemberHttpApplicationService;
  organizationHttp: IIdentityOrganizationHttpApplicationService;
  organizationOnboardingHttp: IIdentityOrganizationOnboardingHttpApplicationService;
  orgTwoFactorPolicy: IOrgTwoFactorPolicyHttp;
  /** The account a person last used Bid as, kept on their profile. */
  rememberedAccount: Pick<RememberedAccountService, "remember" | "restore">;
  /** Which of the person's accounts a consignment or purchase belongs to. */
  recordAccount: Pick<RecordAccountService, "accountFor">;
};

export type {
  IIdentityAccountSecurityHttpApplicationService,
  IIdentityLegalEntityHttpApplicationService,
  IIdentityLegalEntityMemberHttpApplicationService,
  IIdentityOrganizationHttpApplicationService,
  IIdentityOrganizationOnboardingHttpApplicationService,
};
