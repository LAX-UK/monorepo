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
  readonly refreshTokenSealed: string;
  readonly accessTokenSealed: string | null;
  readonly accessTokenExpiresAtMs: number | null;
  readonly status: "healthy" | "needs_reauth";
}

export interface ZohoTokenStore {
  load(organizationId: string): Promise<StoredZohoTokens | null>;
  /** Create or replace a connection with a freshly authorised refresh token; status becomes healthy. */
  saveConnection(organizationId: string, refreshTokenSealed: string): Promise<void>;
  /** Store a refreshed access token; `refreshTokenSealed` only when Zoho rotated the refresh token. */
  saveRefreshed(
    organizationId: string,
    tokens: {
      readonly accessTokenSealed: string;
      readonly accessTokenExpiresAtMs: number;
      readonly refreshTokenSealed?: string;
    },
  ): Promise<void>;
  markNeedsReauth(organizationId: string, errorCode: string): Promise<void>;
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
