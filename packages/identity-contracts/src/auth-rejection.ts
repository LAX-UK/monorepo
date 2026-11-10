/**
 * Wire codes a resource server puts in a 401 `{ code }` envelope when a Bearer token was rejected
 * for a reason that a fresh token fixes. Both are decided by the auth middleware before any
 * handler runs, so a client may replay the rejected request once with a new token.
 *
 * - `token_key_unknown`: signed by a key the issuer no longer publishes (key rotation).
 * - `token_expired`: the signature is valid but `exp` has passed (clock skew at expiry).
 */
export const TOKEN_KEY_UNKNOWN_CODE = "token_key_unknown" as const;
export const TOKEN_EXPIRED_CODE = "token_expired" as const;

export const TOKEN_REPLACEABLE_CODES = [TOKEN_KEY_UNKNOWN_CODE, TOKEN_EXPIRED_CODE] as const;

export type TokenReplaceableCode = (typeof TOKEN_REPLACEABLE_CODES)[number];

/** Code for every other 401: no session, or a credential a new token would not fix. */
export const SESSION_REQUIRED_CODE = "session_required";

export function isTokenReplaceableCode(value: unknown): value is TokenReplaceableCode {
  return (TOKEN_REPLACEABLE_CODES as readonly unknown[]).includes(value);
}
