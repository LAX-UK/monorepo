import type { TokenReplaceableCode } from "@auction/identity-contracts";
import {
  type VerifiedIdentityToken,
  diagnoseTokenRejection,
  verifyIdentityToken,
} from "@auction/identity-contracts/verify";

export type VerifiedToken = VerifiedIdentityToken;

/** Verify Bearer JWT from the auth issuer. Invalid/expired tokens return `null` (never throw). */
export async function verifyBearerToken(options: {
  authorization: string | null | undefined;
  jwksUrl: string;
  issuer: string;
  /** Required — defaults to {@link DEFAULT_JWT_AUDIENCE}. */
  audience?: string | string[] | undefined;
  /** Seconds of clock slack allowed on `exp` and `nbf`. Defaults to none. */
  clockToleranceSeconds?: number | undefined;
}): Promise<VerifiedToken | null> {
  const header = options.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return verifyIdentityToken({
    token: header.slice("Bearer ".length),
    jwksUrl: options.jwksUrl,
    issuer: options.issuer,
    ...(options.audience === undefined ? {} : { audience: options.audience }),
    ...(options.clockToleranceSeconds === undefined
      ? {}
      : { clockToleranceSeconds: options.clockToleranceSeconds }),
  });
}

/**
 * Why a Bearer JWT that did not verify was rejected, when a fresh token would fix it (signing key
 * rotated out, or expired), or `null` for every other failure and when there is no Bearer token.
 */
export async function bearerRejectionCode(options: {
  authorization: string | null | undefined;
  jwksUrl: string;
  issuer: string;
  audience: string | string[];
  clockToleranceSeconds?: number | undefined;
}): Promise<TokenReplaceableCode | null> {
  const header = options.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return diagnoseTokenRejection({
    token: header.slice("Bearer ".length).trim(),
    jwksUrl: options.jwksUrl,
    issuer: options.issuer,
    audience: options.audience,
    ...(options.clockToleranceSeconds === undefined
      ? {}
      : { clockToleranceSeconds: options.clockToleranceSeconds }),
  });
}
