import type { WriteFence } from "@auction/accounting-domain";
import { InMemoryCallBudget } from "./call-budget.js";
import { type ZohoResponse, classifyResponse } from "./classify.js";
import type { ZohoBooksConfig } from "./config.js";
import {
  ZohoAuthError,
  ZohoBooksError,
  ZohoBudgetExhaustedError,
  ZohoFencedError,
  ZohoRateLimitedError,
  type ZohoResult,
  ZohoUnknownError,
  ZohoValidationError,
  zohoFail,
  zohoOk,
} from "./errors.js";
import { RequestGate } from "./gate.js";
import { sendWithTimeout } from "./http.js";
import {
  type CallBudget,
  type Clock,
  METRIC,
  type TransportRequest,
  type ZohoLogger,
  type ZohoMetrics,
  type ZohoTokenStore,
  type ZohoTransport,
  noopLogger,
  noopMetrics,
} from "./ports.js";
import { redactBody, redactQuery, redactingLogger } from "./redact.js";
import { systemClock } from "./system-clock.js";
import { ZohoTokenManager } from "./token-manager.js";
import { ZohoBooksTokenSealer } from "./token-sealer.js";

export type ZohoMethod = "GET" | "POST" | "PUT" | "DELETE";
export type ZohoQuery = Readonly<Record<string, string | number | boolean>>;

export interface ZohoCall {
  /** Which Books organisation (legal entity) this call is for. Tokens, limits and budget are per organisation. */
  readonly organizationId: string;
  readonly method: ZohoMethod;
  /** Path under the API base, e.g. `/invoices/123`. Letters, digits and `-._~/` only. */
  readonly path: string;
  /** Extra query parameters. `organization_id` is set by the client and may not be passed. */
  readonly query?: ZohoQuery;
  /** JSON body for POST/PUT. */
  readonly body?: unknown;
  /**
   * Asked immediately before each attempt of a write is sent (after the gate, budget, token and
   * any retry wait). A refusal ends the call `fenced` (rejected: nothing was sent).
   */
  readonly fence?: WriteFence;
}

/** Options for a single write. */
export interface ZohoWriteOptions {
  readonly fence?: WriteFence;
}

export interface ZohoBooksClientDeps {
  readonly config: ZohoBooksConfig;
  readonly transport: ZohoTransport;
  readonly tokenStore: ZohoTokenStore;
  readonly clock?: Clock;
  readonly budget?: CallBudget;
  readonly logger?: ZohoLogger;
  readonly metrics?: ZohoMetrics;
  /** Uniform in [0, 1): the source of backoff jitter. */
  readonly random?: () => number;
}

const PATH_PATTERN = /^\/[A-Za-z0-9._~\-/]*$/;
const ORG_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const RETRYABLE_SERVER = new Set([500, 502, 503, 504]);

/**
 * The low-level Zoho Books HTTP client. It sends one call at a time through, in order: the daily
 * budget (hard stop), the per-organisation rate and concurrency limits, the access token, a timeout.
 * It never throws a Zoho failure: it returns a `ZohoResult` whose error says whether the call was
 * `rejected` or `unknown` (may have happened).
 *
 * Retries: a GET is retried on 429, 500/502/503/504, HTTP 408, timeouts and connection failures (a local timeout is a `network` error); any other
 * method only on 429 (Zoho did not act on it). A write that ends in 5xx or a timeout is never
 * retried here: it is `unknown`, and the domain looks the document up before trying again. A 401
 * gets one token refresh and replay (safe for every method: Zoho refused it before acting).
 */
/** Share of the daily call budget past which staff are warned, before Books stops answering. */
export const BUDGET_WARNING_SHARE = 0.8;
/** Logged once a day per organisation when the budget passes `BUDGET_WARNING_SHARE`. */
export const BUDGET_WARNING_EVENT = "zoho_books.budget_past_warning";

/** The call number that first goes past the warning share of `limit` (81 of 100). */
export function budgetWarningAt(limit: number): number {
  return Math.floor(limit * BUDGET_WARNING_SHARE) + 1;
}

export class ZohoBooksClient {
  private readonly clock: Clock;
  private readonly budget: CallBudget;
  private readonly logger: ZohoLogger;
  private readonly metrics: ZohoMetrics;
  private readonly random: () => number;
  private readonly gate: RequestGate;
  private readonly tokens: ZohoTokenManager;

  constructor(private readonly deps: ZohoBooksClientDeps) {
    const { config } = deps;
    this.clock = deps.clock ?? systemClock;
    this.budget = deps.budget ?? new InMemoryCallBudget(this.clock, config.dailyCallBudget);
    this.logger = redactingLogger(deps.logger ?? noopLogger);
    this.metrics = deps.metrics ?? noopMetrics;
    this.random = deps.random ?? Math.random;
    this.gate = new RequestGate(this.clock, config);
    // Throws `key_missing` / `key_invalid` here, at construction: no key, no client.
    const sealer = ZohoBooksTokenSealer.fromKey(config.tokenDekKey);
    this.tokens = new ZohoTokenManager({
      config,
      store: deps.tokenStore,
      sealer,
      transport: deps.transport,
      clock: this.clock,
      logger: this.logger,
      metrics: this.metrics,
    });
  }

  /** Stores the refresh token obtained when an organisation was authorised (sealed first). */
  registerRefreshToken(organizationId: string, refreshToken: string): Promise<void> {
    return this.tokens.registerRefreshToken(organizationId, refreshToken);
  }

  get(organizationId: string, path: string, query?: ZohoQuery): Promise<ZohoResult<ZohoResponse>> {
    return this.request({ organizationId, method: "GET", path, ...(query ? { query } : {}) });
  }

  post(
    organizationId: string,
    path: string,
    body: unknown,
    query?: ZohoQuery,
    options?: ZohoWriteOptions,
  ): Promise<ZohoResult<ZohoResponse>> {
    return this.request({
      organizationId,
      method: "POST",
      path,
      body,
      ...(query ? { query } : {}),
      ...(options?.fence ? { fence: options.fence } : {}),
    });
  }

  put(
    organizationId: string,
    path: string,
    body: unknown,
    query?: ZohoQuery,
    options?: ZohoWriteOptions,
  ): Promise<ZohoResult<ZohoResponse>> {
    return this.request({
      organizationId,
      method: "PUT",
      path,
      body,
      ...(query ? { query } : {}),
      ...(options?.fence ? { fence: options.fence } : {}),
    });
  }

  delete(
    organizationId: string,
    path: string,
    query?: ZohoQuery,
  ): Promise<ZohoResult<ZohoResponse>> {
    return this.request({ organizationId, method: "DELETE", path, ...(query ? { query } : {}) });
  }

  async request(call: ZohoCall): Promise<ZohoResult<ZohoResponse>> {
    try {
      return await this.run(call);
    } catch (error) {
      // A bug here must not look like a clean rejection: we cannot say whether a request was sent.
      return zohoFail(
        error instanceof ZohoBooksError ? error : new ZohoUnknownError({ code: "unexpected" }),
      );
    }
  }

  private async run(call: ZohoCall): Promise<ZohoResult<ZohoResponse>> {
    const built = this.build(call);
    if (!built.ok) return built;
    const { config } = this.deps;
    let rejectedToken: string | undefined;
    let refreshedAfter401 = false;

    for (let attempt = 1; ; attempt++) {
      const { result, token } = await this.attempt(call, built.value, attempt, rejectedToken);
      if (result.ok) return result;
      const { error } = result;

      if (error instanceof ZohoAuthError && error.code === "unauthorized" && !refreshedAfter401) {
        refreshedAfter401 = true;
        rejectedToken = token;
        this.metrics.increment(METRIC.retries, { reason: "unauthorized" });
        continue;
      }
      if (attempt >= config.maxAttempts || !this.shouldRetry(call.method, error)) return result;

      const delay = this.delayFor(attempt, error);
      if (delay === null) return result;
      this.metrics.increment(METRIC.retries, { reason: error.kind });
      this.logger.log("info", "zoho_books.retry", {
        organizationId: call.organizationId,
        method: call.method,
        path: call.path,
        attempt,
        reason: error.reason,
        delayMs: delay,
      });
      await this.clock.sleep(delay);
    }
  }

  private build(call: ZohoCall): ZohoResult<{ url: string; body: string | undefined }> {
    if (!ORG_PATTERN.test(call.organizationId)) {
      return zohoFail(new ZohoValidationError({ code: "bad_organization_id" }));
    }
    if (!PATH_PATTERN.test(call.path) || call.path.includes("..") || call.path.includes("//")) {
      return zohoFail(new ZohoValidationError({ code: "bad_path" }));
    }
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(call.query ?? {})) {
      if (key === "organization_id")
        return zohoFail(new ZohoValidationError({ code: "bad_query" }));
      params.set(key, String(value));
    }
    params.set("organization_id", call.organizationId);
    let body: string | undefined;
    if (call.body !== undefined) {
      if (call.method === "GET")
        return zohoFail(new ZohoValidationError({ code: "get_with_body" }));
      try {
        body = JSON.stringify(call.body);
      } catch {
        return zohoFail(new ZohoValidationError({ code: "unserialisable_body" }));
      }
    }
    return zohoOk({ url: `${this.deps.config.apiBaseUrl}${call.path}?${params.toString()}`, body });
  }

  private async attempt(
    call: ZohoCall,
    built: { url: string; body: string | undefined },
    attempt: number,
    rejectedToken: string | undefined,
  ): Promise<{ result: ZohoResult<ZohoResponse>; token: string | undefined }> {
    const { config, transport } = this.deps;
    let token: string | undefined;
    const started = this.clock.now();
    let release: (() => void) | undefined;
    let sent = false;
    let result: ZohoResult<ZohoResponse>;
    let status: number | undefined;
    try {
      release = await this.gate.acquire(call.organizationId);
      await this.takeBudget(call.organizationId);
      token = await this.accessToken(call.organizationId, rejectedToken);
      const request: TransportRequest = {
        method: call.method,
        url: built.url,
        headers: {
          authorization: `Zoho-oauthtoken ${token}`,
          accept: "application/json",
          ...(built.body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(built.body === undefined ? {} : { body: built.body }),
      };
      // The last moment before the request leaves: a send that lost its lease writes nothing.
      if (call.method !== "GET" && call.fence && !(await call.fence.mayWrite())) {
        throw new ZohoFencedError({ code: "lease_lost" });
      }
      this.logger.log("debug", "zoho_books.request", {
        organizationId: call.organizationId,
        method: call.method,
        path: call.path,
        query: redactQuery(call.query),
        body: call.body === undefined ? undefined : redactBody(call.body),
        attempt,
      });
      sent = true;
      const response = await sendWithTimeout(
        { transport, clock: this.clock },
        request,
        config.requestTimeoutMs,
        config.maxResponseBytes,
      );
      status = response.status;
      const classified = classifyResponse(response, this.clock.now());
      result = classified.ok ? zohoOk(classified.value) : zohoFail(classified.error);
      this.logger.log("debug", "zoho_books.response", {
        organizationId: call.organizationId,
        status,
        body: redactBody(classified.ok ? classified.value.body : safeBody(response.body)),
      });
    } catch (error) {
      result = zohoFail(
        error instanceof ZohoBooksError ? error : new ZohoUnknownError({ code: "unexpected" }),
      );
    } finally {
      release?.();
    }

    const outcome = result.ok ? "ok" : result.error.kind;
    this.metrics.increment(METRIC.calls, { outcome });
    this.logger.log(result.ok ? "info" : "warn", "zoho_books.call", {
      organizationId: call.organizationId,
      method: call.method,
      path: call.path,
      attempt,
      sent,
      status,
      outcome,
      ...(result.ok
        ? {}
        : {
            reason: result.error.reason,
            certainty: result.error.certainty,
            zohoCode: result.error.zohoCode,
          }),
      durationMs: this.clock.now() - started,
    });
    return { result, token };
  }

  private async accessToken(organizationId: string, rejected: string | undefined): Promise<string> {
    try {
      return await this.tokens.getAccessToken(organizationId, rejected);
    } catch (error) {
      // Nothing has been sent to the Books API, so whatever went wrong getting a token, the call was rejected.
      if (error instanceof ZohoAuthError || error instanceof ZohoRateLimitedError) throw error;
      throw new ZohoAuthError({ code: "token_unavailable" });
    }
  }

  private async takeBudget(organizationId: string): Promise<void> {
    let decision: Awaited<ReturnType<CallBudget["consume"]>>;
    try {
      decision = await this.budget.consume(organizationId);
    } catch {
      // If we cannot count, we do not send.
      throw new ZohoBudgetExhaustedError({ code: "budget_unavailable" });
    }
    this.metrics.gauge(METRIC.budgetUsed, decision.used, { organization: organizationId });
    if (decision.allowed && decision.used === budgetWarningAt(decision.limit)) {
      // Once a day per organisation: the call that takes the budget past its warning share.
      this.logger.log("warn", BUDGET_WARNING_EVENT, {
        organizationId,
        used: decision.used,
        limit: decision.limit,
      });
    }
    if (!decision.allowed) {
      this.metrics.increment(METRIC.budgetExhausted, { organization: organizationId });
      this.logger.log("error", "zoho_books.budget_exhausted", {
        organizationId,
        used: decision.used,
        limit: decision.limit,
      });
      throw new ZohoBudgetExhaustedError({ code: "daily_budget_spent" });
    }
  }

  private shouldRetry(method: ZohoMethod, error: ZohoBooksError): boolean {
    if (error instanceof ZohoRateLimitedError) return error.source === "remote";
    if (method !== "GET") return false;
    switch (error.kind) {
      case "network":
        return true;
      case "server":
        return error.httpStatus !== undefined && RETRYABLE_SERVER.has(error.httpStatus);
      case "unknown":
        // Only an HTTP 408 reply; our own timeout is a `network` error (see http.ts).
        return error.code === "request_timeout";
      default:
        return false;
    }
  }

  /** Exponential backoff with equal jitter; a Retry-After is honoured, or the error returned if it is too long. */
  private delayFor(attempt: number, error: ZohoBooksError): number | null {
    const { config } = this.deps;
    const ceiling = Math.min(config.retryMaxDelayMs, config.retryBaseDelayMs * 2 ** (attempt - 1));
    const backoff = ceiling / 2 + (this.random() * ceiling) / 2;
    if (error.retryAfterMs === undefined) return Math.round(backoff);
    if (error.retryAfterMs > config.maxRetryAfterMs) return null;
    return Math.round(Math.max(error.retryAfterMs, backoff));
  }
}

function safeBody(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}
