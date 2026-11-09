import { type JWTPayload, decodeJwt, decodeProtectedHeader, errors, jwtVerify } from "jose";
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
}): Promise<VerifiedIdentityToken | null> {
  const token = options.token.trim();
  if (!token) return null;

  const audience = options.audience ?? DEFAULT_JWT_AUDIENCE;
  try {
    const result = await jwtVerify(token, jwksFor(options.jwksUrl), {
      issuer: options.issuer,
      audience,
      algorithms: ["RS256"],
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

/**
 * Whether the key that signed `token` is still published by the issuer.
 *
 * An unknown `kid` makes the key set refetch (rate-limited), so a freshly rotated key is picked
 * up and a retired one is detected. A key counts as retired only when the key set was fetched
 * after the token was issued, or the key was published earlier and is now gone. A token newer
 * than the last fetch may simply be signed by a key we have not fetched yet, so it is kept; the
 * resource server still verifies every request. The same goes for an unreachable key set:
 * issuer availability must not invalidate otherwise healthy tokens.
 */
export async function isSigningKeyCurrent(options: {
  token: string;
  jwksUrl: string;
}): Promise<boolean> {
  let header: ReturnType<typeof decodeProtectedHeader>;
  let issuedAtMs: number | null;
  try {
    header = decodeProtectedHeader(options.token);
    const iat = decodeJwt(options.token).iat;
    issuedAtMs = typeof iat === "number" ? iat * 1000 : null;
  } catch {
    return false;
  }
  if (!header.kid || header.alg !== "RS256") return false;
  const holder = jwksHolderFor(options.jwksUrl);
  try {
    await holder.getKey({ alg: "RS256", kid: header.kid });
    return true;
  } catch (error) {
    if (!(error instanceof errors.JWKSNoMatchingKey)) return true;
    if (holder.hasSeen(header.kid)) return false;
    const fetchedAt = holder.fetchedAt();
    return !(fetchedAt !== null && issuedAtMs !== null && fetchedAt > issuedAtMs + IAT_MARGIN_MS);
  }
}
