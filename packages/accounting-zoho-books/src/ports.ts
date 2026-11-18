/** Time, injected so tests never wait and nothing reads the wall clock. */
export interface Clock {
  /** Epoch milliseconds. */
  now(): number;
  /** Resolves after `ms`, or as soon as `signal` aborts (so a finished race leaves no timer behind). */
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

export interface TransportRequest {
  readonly method: "GET" | "POST" | "PUT" | "DELETE";
  readonly url: string;
  /** Contains credentials: never log it. */
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
}

export interface TransportResponse {
  readonly status: number;
  /** Lower-case header names. */
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

/**
 * The one place bytes leave the process. A real implementation must not follow redirects (the
 * Authorization header would go with them) and should cap the body it reads. It rejects on a
 * connection failure or when `signal` aborts.
 */
export interface ZohoTransport {
  send(request: TransportRequest, signal: AbortSignal): Promise<TransportResponse>;
}

/** What is stored per organisation. Only sealed values: the store never sees a plaintext token. */
export interface StoredZohoTokens {
  /**
   * Opaque. Changes whenever the connection row changes (reconnect, refresh, reauth flag), for
   * example its `updated_at`. Writes that follow a read pass it back and apply only if it still matches.
   */
  readonly version: string;
  readonly refreshTokenSealed: string;
  readonly accessTokenSealed: string | null;
  readonly accessTokenExpiresAtMs: number | null;
  readonly status: "healthy" | "needs_reauth";
}

export interface ZohoTokenStore {
  load(organizationId: string): Promise<StoredZohoTokens | null>;
  /** Create or replace a connection with a freshly authorised refresh token; status becomes healthy. */
  saveConnection(organizationId: string, refreshTokenSealed: string): Promise<void>;
  /**
   * Store a refreshed access token; `refreshTokenSealed` only when Zoho rotated the refresh token.
   * Compare-and-set: applies only if the row's version is still `expectedVersion`. Returns whether it applied.
   */
  saveRefreshed(
    organizationId: string,
    expectedVersion: string,
    tokens: {
      readonly accessTokenSealed: string;
      readonly accessTokenExpiresAtMs: number;
      readonly refreshTokenSealed?: string;
    },
  ): Promise<boolean>;
  /** Compare-and-set like `saveRefreshed`: a reconnect after `expectedVersion` was read is never flagged. */
  markNeedsReauth(
    organizationId: string,
    expectedVersion: string,
    errorCode: string,
  ): Promise<boolean>;
}

export interface BudgetDecision {
  readonly allowed: boolean;
  readonly used: number;
  readonly limit: number;
}

/** Counts every request sent to Zoho for one organisation in the current day. */
export interface CallBudget {
  /** Take one call if any is left. An implementation that cannot tell must reject (the client fails closed). */
  consume(organizationId: string): Promise<BudgetDecision>;
}

/**
 * The per-organisation request window, shared by every process that calls one Books organisation
 * (Zoho's limit is per organisation, not per caller). Without one each client keeps its own window.
 */
export interface RateWindow {
  /**
   * Take one request slot if fewer than `limit` were taken in the last `windowMs`. Resolves 0 when
   * taken, otherwise how many milliseconds until one may free. An implementation that cannot tell
   * must reject (the client then backs off and sends nothing).
   */
  take(organizationId: string, limit: number, windowMs: number): Promise<number>;
}

/**
 * A lock per organisation held around "load the stored tokens, refresh if needed, save", shared by
 * every process, so one refresh is made however many processes need a token at once. The process
 * that waited reads the stored token the first one saved and sends nothing.
 */
export interface RefreshLock {
  /** Runs `work` while holding the organisation's lock. Rejects, without running it, when the lock cannot be taken. */
  withLock<T>(organizationId: string, work: () => Promise<T>): Promise<T>;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface ZohoLogger {
  log(level: LogLevel, event: string, fields: Readonly<Record<string, unknown>>): void;
}

export interface ZohoMetrics {
  increment(name: string, labels?: Readonly<Record<string, string>>, value?: number): void;
  gauge(name: string, value: number, labels?: Readonly<Record<string, string>>): void;
}

export const noopLogger: ZohoLogger = { log() {} };
export const noopMetrics: ZohoMetrics = { increment() {}, gauge() {} };

export const METRIC = {
  calls: "zoho_books_calls_total",
  retries: "zoho_books_retries_total",
  budgetUsed: "zoho_books_daily_calls_used",
  budgetExhausted: "zoho_books_daily_budget_exhausted_total",
  tokenRefresh: "zoho_books_token_refresh_total",
} as const;
