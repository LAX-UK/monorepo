import { OIDC_ACR_SILVER } from "@auction/identity-contracts";

export type AccountOverviewVm = {
  /** Greeting name: profile name, else email, else a neutral label. */
  displayName: string;
  name: string | null;
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  /**
   * True when this sign-in completed a second factor. Silver ACR proves the
   * session used an authenticator; bronze does not prove one is absent.
   */
  signedInWithAuthenticator: boolean;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function buildAccountOverview(
  claims: Readonly<Record<string, unknown>>,
  sessionAcr: string,
): AccountOverviewVm {
  const name = text(claims.name);
  const email = text(claims.email);
  const phone = text(claims.phone_number);
  const acr = text(claims.acr) ?? sessionAcr;
  return {
    displayName: name ?? email ?? "Your LAX account",
    name,
    email,
    emailVerified: claims.email_verified === true,
    phone,
    phoneVerified: phone !== null && claims.phone_number_verified === true,
    signedInWithAuthenticator: acr === OIDC_ACR_SILVER,
  };
}
