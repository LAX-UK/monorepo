import { type JWTPayload, decodeJwt, decodeProtectedHeader, errors, jwtVerify } from "jose";
import {
  TOKEN_EXPIRED_CODE,
  TOKEN_KEY_UNKNOWN_CODE,
  type TokenReplaceableCode,
} from "./auth-rejection.js";
import { DEFAULT_JWT_AUDIENCE } from "./claims.js";
import { jwksFor, jwksHolderFor } from "./jwks-holder.js";

/**
 * Clock slack between the issuer and this verifier: a key set fetched less than this after a token
 * was issued may still predate the key that signed it.
 */
const IAT_MARGIN_MS = 5_000;

export type VerifiedIdentityToken = {
  payload: JWTPayload;
  subject: string;
};

/** Verify an Identity-issued JWT. Invalid/expired tokens return `null` (never throw). */
export async function verifyIdentityToken(options: {
  token: string;
  jwksUrl: string;
  issuer: string;
  /** Defaults to {@link DEFAULT_JWT_AUDIENCE}. */
  audience?: string | string[] | undefined;
  /** Seconds of clock slack allowed on `exp` and `nbf`. Defaults to none. */
  clockToleranceSeconds?: number | undefined;
}): Promise<VerifiedIdentityToken | null> {
  const token = options.token.trim();
  if (!token) return null;

  const audience = options.audience ?? DEFAULT_JWT_AUDIENCE;
  try {
    const result = await jwtVerify(token, jwksFor(options.jwksUrl), {
      issuer: options.issuer,
      audience,
      algorithms: ["RS256"],
      ...(options.clockToleranceSeconds ? { clockTolerance: options.clockToleranceSeconds } : {}),
    });
    if (!result.payload.sub) return null;
    if (
      typeof audience === "string"
        ? result.payload.aud !== audience
        : typeof result.payload.aud !== "string" || !audience.includes(result.payload.aud)
    ) {
      return null;
    }
    return { payload: result.payload, subject: result.payload.sub };
  } catch {
    return null;
  }
}

/** Where the key that signed a token stands in the issuer's published key set. */
export type SigningKeyStatus = "current" | "retired" | "malformed";

/**
 * Where the key that signed `token` stands in the issuer's published key set.
 *
 * An unknown `kid` makes the key set refetch (rate-limited), so a freshly rotated key is picked
 * up and a retired one is detected. A key counts as retired only when the key set was fetched
 * after the token was issued, or the key was published earlier and is now gone. A token newer
 * than the last fetch may simply be signed by a key we have not fetched yet, so it is kept; the
 * resource server still verifies every request. The same goes for an unreachable key set:
 * issuer availability must not invalidate otherwise healthy tokens.
 */
export async function signingKeyStatus(options: {
  token: string;
  jwksUrl: string;
}): Promise<SigningKeyStatus> {
  let header: ReturnType<typeof decodeProtectedHeader>;
  let issuedAtMs: number | null;
  try {
    header = decodeProtectedHeader(options.token);
    const iat = decodeJwt(options.token).iat;
    issuedAtMs = typeof iat === "number" ? iat * 1000 : null;
  } catch {
    return "malformed";
  }
  if (!header.kid || header.alg !== "RS256") return "malformed";
  const holder = jwksHolderFor(options.jwksUrl);
  try {
    await holder.getKey({ alg: "RS256", kid: header.kid });
    return "current";
  } catch (error) {
    if (!(error instanceof errors.JWKSNoMatchingKey)) return "current";
    if (holder.hasSeen(header.kid)) return "retired";
    const fetchedAt = holder.fetchedAt();
    return fetchedAt !== null && issuedAtMs !== null && fetchedAt > issuedAtMs + IAT_MARGIN_MS
      ? "retired"
      : "current";
  }
}

/** Whether the key that signed `token` is still published by the issuer (see {@link signingKeyStatus}). */
export async function isSigningKeyCurrent(options: {
  token: string;
  jwksUrl: string;
}): Promise<boolean> {
  return (await signingKeyStatus(options)) === "current";
}

/**
 * Whether `token` is genuine but past its `exp`: signature, issuer and audience all verify as of
 * the moment just before it expired. Anything else (bad signature, wrong audience, unknown key,
 * unreadable) is `false`, so only an honest expiry is ever reported.
 */
export async function isExpiredWithValidSignature(options: {
  token: string;
  jwksUrl: string;
  issuer: string;
  audience: string | string[];
  clockToleranceSeconds?: number | undefined;
}): Promise<boolean> {
  let exp: unknown;
  try {
    exp = decodeJwt(options.token).exp;
  } catch {
    return false;
  }
  if (typeof exp !== "number") return false;
  const toleranceMs = (options.clockToleranceSeconds ?? 0) * 1000;
  if (exp * 1000 + toleranceMs > Date.now()) return false;
  try {
    await jwtVerify(options.token, jwksFor(options.jwksUrl), {
      issuer: options.issuer,
      audience: options.audience,
      algorithms: ["RS256"],
      currentDate: new Date((exp - 1) * 1000),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Why a Bearer token that did not verify was rejected, when a fresh token would fix it: the
 * signing key was rotated out, or the token has expired. `null` for everything else, so those
 * failures stay indistinguishable from each other. An unreachable key set is not a rotation
 * ({@link signingKeyStatus} keeps such tokens), so an issuer outage yields `null` and no retry.
 */
export async function diagnoseTokenRejection(options: {
  token: string;
  jwksUrl: string;
  issuer: string;
  audience: string | string[];
  clockToleranceSeconds?: number | undefined;
}): Promise<TokenReplaceableCode | null> {
  const status = await signingKeyStatus(options);
  if (status === "retired") return TOKEN_KEY_UNKNOWN_CODE;
  if (status === "current" && (await isExpiredWithValidSignature(options))) {
    return TOKEN_EXPIRED_CODE;
  }
  return null;
}
