import "server-only";

/** Stable code the Bid API puts in its 401 envelope when the token's signing key was rotated out. */
export const TOKEN_KEY_UNKNOWN_CODE = "token_key_unknown";

const MAX_ENVELOPE_BYTES = 4096;

/** The exchange for a fresh token failed; `cause` is the original error. */
export class TokenRefreshFailedError extends Error {
  override readonly cause: unknown;
  constructor(cause: unknown) {
    super("Resource token exchange failed");
    this.cause = cause;
    this.name = "TokenRefreshFailedError";
  }
}

/**
 * True only for the API's 401 that names an unknown signing key. Every other 401 (expired token,
 * revoked session, bad audience) is a different failure that a new token would not fix. The body
 * is read from a clone, so the caller's response stays unread.
 */
export async function isTokenKeyUnknownRejection(response: Response): Promise<boolean> {
  if (response.status !== 401) return false;
  if (!response.headers.get("content-type")?.includes("json")) return false;
  try {
    const text = await response.clone().text();
    if (text.length > MAX_ENVELOPE_BYTES) return false;
    return (JSON.parse(text) as { code?: unknown } | null)?.code === TOKEN_KEY_UNKNOWN_CODE;
  } catch {
    return false;
  }
}

/**
 * The one cache-invalidation policy for resource tokens: send with the cached token; if the API
 * says its signing key is unknown, replace the cached token through `refresh` (a forced
 * exchange, which overwrites the cache entry) and send once more. Never loops: the second
 * response is returned whatever it is.
 *
 * Replaying is safe for any method because that 401 comes from the API's auth middleware, which
 * runs before every handler, so the rejected request had no effect.
 */
export async function sendWithKeyRetry<R extends { token: string }>(options: {
  /** The cached or exchanged token, or `null` for a request that carries none. */
  resource: R | null;
  refresh: () => Promise<R>;
  send: (token: string | undefined) => Promise<Response>;
}): Promise<{ response: Response; resource: R | null }> {
  const first = await options.send(options.resource?.token);
  if (!options.resource || !(await isTokenKeyUnknownRejection(first))) {
    return { response: first, resource: options.resource };
  }
  await first.body?.cancel().catch(() => undefined);
  let fresh: R;
  try {
    fresh = await options.refresh();
  } catch (error) {
    throw new TokenRefreshFailedError(error);
  }
  return { response: await options.send(fresh.token), resource: fresh };
}
