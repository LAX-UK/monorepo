import type { CreateOrganizationInput, PublicOrganisationSubkind } from "@auction/validators";
import type { IdentityRouteOutcome } from "./identity-route-http.js";

export interface IIdentityOrganizationHttpApplicationService {
  listSubkinds(): IdentityRouteOutcome<
    { value: PublicOrganisationSubkind; label: string; description: string }[]
  >;

  getRequirements(input: {
    subkind: PublicOrganisationSubkind;
  }): IdentityRouteOutcome<unknown>;

  checkNameAvailability(input: { displayName: string }): Promise<IdentityRouteOutcome<unknown>>;

  createOrganization(input: {
    userId: string;
    body: CreateOrganizationInput;
  }): Promise<IdentityRouteOutcome<unknown>>;
}
