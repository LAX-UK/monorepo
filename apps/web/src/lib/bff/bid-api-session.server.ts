import "server-only";

import { fetchBidApi } from "@/lib/data/http/bid-api.server";
import { BID_API_AUDIENCE } from "./config.server";
import { sendWithKeyRetry } from "./token-key-retry.server";
import { BidBffTokenService } from "./token-service.server";

/** Getting a resource token for the session failed; `cause` is the original error. */
export class TokenExchangeFailedError extends Error {
  override readonly cause: unknown;
  constructor(cause: unknown) {
    super("Resource token exchange failed");
    this.cause = cause;
    this.name = "TokenExchangeFailedError";
  }
}

type ResourceToken = Awaited<ReturnType<BidBffTokenService["resourceToken"]>>;

export type BidApiSessionRequest = {
  /** The BFF session to act as, or `null` for a request that carries no credential. */
  sessionId: string | null;
  scopes: string;
  input: string | URL;
  /**
   * The request for one attempt, given the Bearer token to send (`undefined` without a session).
   * It is called again for the retry, so anything single-use (an abort signal) is made fresh and
   * the body must be replayable (a string or buffered bytes, never a stream).
   */
  init: (token: string | undefined) => RequestInit;
  tokens?: BidBffTokenService;
};

/**
 * The server-side Bid API client for a BFF session. It sends with the session's cached resource
 * token and applies the one retry policy ({@link sendWithKeyRetry}): when the API says the token
 * is replaceable (signing key rotated out, or expired), the token is replaced by a single
 * exchange, shared with concurrent requests, and the request is sent once more.
 *
 * Failing to get a token, first or on retry, throws {@link TokenExchangeFailedError}; the fetch's
 * own errors pass through. `resource` is the token the returned response was answered for.
 */
export function fetchBidApiAsSession(
  request: BidApiSessionRequest & { sessionId: string },
): Promise<{ response: Response; resource: ResourceToken }>;
export function fetchBidApiAsSession(
  request: BidApiSessionRequest,
): Promise<{ response: Response; resource: ResourceToken | null }>;
export async function fetchBidApiAsSession(
  request: BidApiSessionRequest,
): Promise<{ response: Response; resource: ResourceToken | null }> {
  const { sessionId, scopes } = request;
  if (!sessionId) {
    return { response: await fetchBidApi(request.input, request.init(undefined)), resource: null };
  }
  const tokens = request.tokens ?? new BidBffTokenService();
  const exchange = async (replacing?: string): Promise<ResourceToken> => {
    try {
      return replacing === undefined
        ? await tokens.resourceToken(sessionId, BID_API_AUDIENCE, scopes)
        : await tokens.resourceToken(sessionId, BID_API_AUDIENCE, scopes, { replacing });
    } catch (error) {
      throw new TokenExchangeFailedError(error);
    }
  };
  return sendWithKeyRetry<ResourceToken>({
    resource: await exchange(),
    refresh: (rejected) => exchange(rejected.token),
    send: (resource) => fetchBidApi(request.input, request.init(resource?.token)),
  });
}
