import { OIDC_ACR_BRONZE, OIDC_ACR_SILVER } from "@auction/identity-contracts";

/** The Identity session facts an ID token's session claims are derived from. */
export type IdentitySessionClaimSource = {
  id: string;
  createdAt: Date;
  lastPasswordAuthAt: Date | null;
  mfaCompletedAt: Date | null;
};

export type OidcSessionClaims = {
  sid: string;
  auth_time: number;
  acr: string;
  amr?: string[];
};

/**
 * Session claims for an ID token: the session id, when the person signed in, and how strongly.
 * One derivation for the authorization-code token and for tokens renewed on refresh, so both
 * always describe the same sign-in the same way.
 */
export function oidcSessionClaims(session: IdentitySessionClaimSource): OidcSessionClaims {
  const amr = session.mfaCompletedAt
    ? ["pwd", "otp"]
    : session.lastPasswordAuthAt
      ? ["pwd"]
      : undefined;
  return {
    sid: session.id,
    auth_time: Math.floor(session.createdAt.getTime() / 1_000),
    acr: session.mfaCompletedAt !== null ? OIDC_ACR_SILVER : OIDC_ACR_BRONZE,
    ...(amr ? { amr } : {}),
  };
}
