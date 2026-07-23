import type { CreateOrganizationInput, PublicOrganisationSubkind } from "@auction/validators";
import type { OrgModuleGate } from "../../lib/org-module-gate.js";
import type { IIdentityOrganizationHttpApplicationService } from "../interfaces/identity-routes/identity-organization-http.js";
import {
  type IdentityRouteOutcome,
  identityRouteCodeErr,
} from "../interfaces/identity-routes/identity-route-http.js";
import type { IOrganizationOnboardingService } from "../interfaces/organization-onboarding.js";

export class IdentityOrganizationHttpApplicationService
  implements IIdentityOrganizationHttpApplicationService
{
  constructor(
    private readonly organizationOnboardingService: IOrganizationOnboardingService,
    private readonly orgModuleGate: OrgModuleGate,
  ) {}

  listSubkinds(): IdentityRouteOutcome<
    { value: PublicOrganisationSubkind; label: string; description: string }[]
  > {
    return { kind: "ok", data: this.organizationOnboardingService.listSubkinds() };
  }

  getRequirements(input: {
    subkind: PublicOrganisationSubkind;
  }): IdentityRouteOutcome<unknown> {
    return { kind: "ok", data: this.organizationOnboardingService.getRequirements(input.subkind) };
  }

  async checkNameAvailability(input: {
    displayName: string;
  }): Promise<IdentityRouteOutcome<unknown>> {
    const result = await this.organizationOnboardingService.checkNameAvailability(
      input.displayName,
    );
    return { kind: "ok", data: result };
  }

  async createOrganization(input: {
    userId: string;
    body: CreateOrganizationInput;
  }): Promise<IdentityRouteOutcome<unknown>> {
    if (!this.orgModuleGate.isEnabled()) {
      const disabled = this.orgModuleGate.disabledResponse();
      return {
        kind: "err",
        error: { message: disabled.error, status: 403, code: disabled.code },
      };
    }
    try {
      const result = await this.organizationOnboardingService.createOrganization(
        input.userId,
        input.body,
      );
      return { kind: "ok", data: result, status: 201 };
    } catch (e) {
      if (e instanceof Error && e.message === "organization_limit_reached") {
        return identityRouteCodeErr("organization_limit_reached", 429);
      }
      throw e;
    }
  }
}
