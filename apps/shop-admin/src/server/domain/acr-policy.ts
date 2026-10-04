import { OIDC_ACR_SILVER } from "@auction/identity-contracts";

export function assertSilverAcr(acr: string | undefined): void {
  if (acr !== OIDC_ACR_SILVER) {
    throw new Error("Silver MFA (step-up) required for shop staff admin");
  }
}
