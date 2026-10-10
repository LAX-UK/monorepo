import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import { StaffLoginError } from "./staff-login-failure";

export function assertSilverAcr(acr: string | undefined): void {
  if (acr !== OIDC_ACR_SILVER) {
    throw new StaffLoginError("mfa_required", "Silver MFA (step-up) required for shop staff admin");
  }
}
