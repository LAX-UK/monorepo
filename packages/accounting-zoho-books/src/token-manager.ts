import type { ZohoBooksConfig } from "./config.js";
import {
  ZohoAuthError,
  ZohoBooksError,
  ZohoNetworkError,
  ZohoRateLimitedError,
  ZohoServerError,
  ZohoUnknownError,
} from "./errors.js";
import { parseJson, sendWithTimeout } from "./http.js";
import {
  type Clock,
  METRIC,
  type StoredZohoTokens,
  type ZohoLogger,
  type ZohoMetrics,
  type ZohoTokenStore,
  type ZohoTransport,
} from "./ports.js";
import { type ZohoBooksTokenSealer, ZohoBooksTokenSealingError } from "./token-sealer.js";

/** A cached token is renewed this long before it expires. */
const EXPIRY_SKEW_MS = 60_000;
const MAX_TOKEN_LIFETIME_MS = 24 * 3_600_000;
/** Zoho answers HTTP 200 with `{"error": ...}` for a bad refresh token. */
const REAUTH_ERRORS: ReadonlySet<string> = new Set(["invalid_code", "invalid_grant"]);

export interface TokenManagerDeps {
  readonly config: ZohoBooksConfig;
  readonly store: ZohoTokenStore;
  readonly sealer: ZohoBooksTokenSealer;
  readonly transport: ZohoTransport;
  readonly clock: Clock;
  readonly logger: ZohoLogger;
  readonly metrics: ZohoMetrics;
}

interface CachedToken {
  readonly accessToken: string;
  readonly expiresAtMs: number;
}

/**
 * Gives out access tokens, refreshing them when needed. Refreshes are single-flight per organisation:
 * however many calls ask at once, one request goes to Zoho and all of them share its answer (Zoho
 * limits how many tokens one refresh token may mint). Plaintext tokens live only in this
 * process's memory; the store only ever sees sealed values. Single-flight is per process; sharing a
 * refresh across processes is the store's job (an advisory lock in the adapter's runtime).
 */
export class ZohoTokenManager {
  private readonly cache = new Map<string, CachedToken>();
  private readonly inflight = new Map<string, Promise<CachedToken>>();

  constructor(private readonly deps: TokenManagerDeps) {}

  /** Records a refresh token obtained when staff authorised the organisation (sealed before it is stored). */
  async registerRefreshToken(organizationId: string, refreshToken: string): Promise<void> {
    if (refreshToken.trim() === "") throw new ZohoAuthError({ code: "refresh_token_missing" });
    await this.deps.store.saveConnection(organizationId, this.deps.sealer.seal(refreshToken));
    this.cache.delete(organizationId);
  }

  /**
   * A valid access token. Pass `rejected` after Zoho refused a token with 401: if another call has
   * already replaced it that one is used, otherwise a refresh is forced.
   */
  getAccessToken(organizationId: string, rejected?: string): Promise<string> {
    const cached = this.cache.get(organizationId);
    if (cached && cached.accessToken !== rejected && this.isFresh(cached)) {
      return Promise.resolve(cached.accessToken);
    }
    let flight = this.inflight.get(organizationId);
    if (!flight) {
      flight = this.obtain(organizationId, rejected).finally(() => {
        this.inflight.delete(organizationId);
      });
      this.inflight.set(organizationId, flight);
    }
    return flight.then((token) => token.accessToken);
  }

  private isFresh(token: CachedToken): boolean {
    return token.expiresAtMs - EXPIRY_SKEW_MS > this.deps.clock.now();
  }

  private async obtain(organizationId: string, rejected: string | undefined): Promise<CachedToken> {
    const { store, sealer } = this.deps;
    let stored: StoredZohoTokens | null;
    try {
      stored = await store.load(organizationId);
    } catch {
      throw new ZohoAuthError({ code: "token_store_unavailable" });
    }
    if (!stored) throw new ZohoAuthError({ code: "not_connected" });
    if (stored.status === "needs_reauth") throw new ZohoAuthError({ code: "reauth_required" });

    try {
      // Another process may have refreshed already: use its token unless it is the one just refused.
      if (stored.accessTokenSealed !== null && stored.accessTokenExpiresAtMs !== null) {
        const candidate = { accessToken: "", expiresAtMs: stored.accessTokenExpiresAtMs };
        if (this.isFresh(candidate)) {
          const accessToken = sealer.open(stored.accessTokenSealed);
          if (accessToken !== rejected)
            return this.remember(organizationId, accessToken, candidate.expiresAtMs);
        }
      }
      const refreshToken = sealer.open(stored.refreshTokenSealed);
      return await this.refresh(organizationId, refreshToken);
    } catch (error) {
      if (error instanceof ZohoBooksTokenSealingError) {
        throw new ZohoAuthError({ code: `token_${error.code}` });
      }
      throw error;
    }
  }

  private remember(organizationId: string, accessToken: string, expiresAtMs: number): CachedToken {
    const token = { accessToken, expiresAtMs };
    this.cache.set(organizationId, token);
    return token;
  }

  private async refresh(organizationId: string, refreshToken: string): Promise<CachedToken> {
    const { config, clock, store, sealer, metrics, logger } = this.deps;
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret.reveal(),
      refresh_token: refreshToken,
    }).toString();
    const request = {
      method: "POST" as const,
      url: `${config.accountsBaseUrl}/oauth/v2/token`,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body,
    };

    const started = clock.now();
    let outcome: "ok" | "reauth" | "error" = "error";
    try {
      const response = await this.sendWithRetry(request);
      const parsed = parseJson(response.body);
      const payload =
        parsed.ok && typeof parsed.value === "object"
          ? (parsed.value as Record<string, unknown>)
          : null;

      if (response.status >= 500)
        throw new ZohoServerError({
          code: `token_http_${response.status}`,
          httpStatus: response.status,
        });
      if (response.status === 429)
        throw new ZohoRateLimitedError({ code: "token_rate_limited", httpStatus: 429 });
      if (payload === null)
        throw new ZohoUnknownError({
          code: "token_unreadable_response",
          httpStatus: response.status,
        });

      const failure = typeof payload.error === "string" ? payload.error : null;
      if (failure !== null) {
        if (REAUTH_ERRORS.has(failure)) {
          outcome = "reauth";
          await store
            .markNeedsReauth(organizationId, `zoho_books_${failure}`)
            .catch(() => undefined);
          throw new ZohoAuthError({ code: "reauth_required", httpStatus: response.status });
        }
        if (/too many requests/i.test(failure)) {
          throw new ZohoRateLimitedError({
            code: "token_rate_limited",
            httpStatus: response.status,
          });
        }
        throw new ZohoAuthError({ code: "refresh_failed", httpStatus: response.status });
      }

      const accessToken = payload.access_token;
      const seconds = payload.expires_in_sec ?? payload.expires_in;
      if (
        response.status !== 200 ||
        typeof accessToken !== "string" ||
        accessToken === "" ||
        typeof seconds !== "number" ||
        !(seconds > 0)
      ) {
        throw new ZohoAuthError({ code: "refresh_failed", httpStatus: response.status });
      }
      const rotated =
        typeof payload.refresh_token === "string" && payload.refresh_token !== ""
          ? payload.refresh_token
          : undefined;
      const expiresAtMs = clock.now() + Math.min(seconds * 1000, MAX_TOKEN_LIFETIME_MS);

      try {
        await store.saveRefreshed(organizationId, {
          accessTokenSealed: sealer.seal(accessToken),
          accessTokenExpiresAtMs: expiresAtMs,
          ...(rotated === undefined ? {} : { refreshTokenSealed: sealer.seal(rotated) }),
        });
      } catch {
        // Nothing has been sent to the Books API yet; a rotated refresh token we could not store must not be used.
        throw new ZohoAuthError({ code: "token_store_unavailable" });
      }
      outcome = "ok";
      return this.remember(organizationId, accessToken, expiresAtMs);
    } finally {
      metrics.increment(METRIC.tokenRefresh, { outcome });
      logger.log(outcome === "ok" ? "info" : "warn", "zoho_books.token_refresh", {
        organizationId,
        outcome,
        durationMs: clock.now() - started,
      });
    }
  }

  /** The token endpoint is safe to repeat: retry network failures a couple of times. */
  private async sendWithRetry(request: Parameters<typeof sendWithTimeout>[1]) {
    const { config, clock, transport } = this.deps;
    const attempts = Math.min(config.maxAttempts, 3);
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await sendWithTimeout(
          { transport, clock },
          request,
          config.requestTimeoutMs,
          config.maxResponseBytes,
        );
        if (response.status < 500 || attempt >= attempts) return response;
      } catch (error) {
        const retryable = error instanceof ZohoNetworkError;
        if (!retryable || attempt >= attempts) {
          throw error instanceof ZohoBooksError
            ? error
            : new ZohoNetworkError({ code: "connection_failed" });
        }
      }
      await clock.sleep(
        Math.min(config.retryMaxDelayMs, config.retryBaseDelayMs * 2 ** (attempt - 1)),
      );
    }
  }
}
