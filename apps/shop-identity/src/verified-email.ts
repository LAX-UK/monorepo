import { type JWTPayload, decodeJwt } from "jose";
import type { ShopIdentityTokenService } from "./application/shop-identity-token.service.js";

/** Lets a just-verified email take effect within a minute instead of at ID token expiry. */
const UNVERIFIED_CLAIMS_MAX_AGE_MS = 60_000;

function decodeClaims(idToken: string): JWTPayload | null {
  try {
    return decodeJwt(idToken);
  } catch {
    return null;
  }
}

export async function readRecentIdTokenClaims(
  tokenService: Pick<ShopIdentityTokenService, "resolveIdToken">,
  sessionId: string,
  fallback: JWTPayload,
): Promise<JWTPayload> {
  try {
    const idToken = await tokenService.resolveIdToken(sessionId, {
      maxAgeMs: UNVERIFIED_CLAIMS_MAX_AGE_MS,
    });
    return decodeClaims(idToken) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Fails closed: only an explicit `email_verified: true` claim passes. */
export async function hasVerifiedEmail(
  tokenService: Pick<ShopIdentityTokenService, "resolveIdToken">,
  sessionId: string,
  idToken: string,
): Promise<boolean> {
  const claims = decodeClaims(idToken);
  if (claims?.email_verified === true) return true;
  const recent = await readRecentIdTokenClaims(tokenService, sessionId, claims ?? {});
  return recent.email_verified === true;
}
