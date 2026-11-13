import { WRITE_MARGIN_MS } from "@auction/accounting-domain";
import { Secret } from "./secret.js";

export class ZohoBooksConfigError extends Error {
  constructor(readonly code: string) {
    super(`zoho_books_config_${code}`);
    this.name = "ZohoBooksConfigError";
  }
}

export interface ZohoBooksConfig {
  /** EU data centre API base, e.g. https://books.zoho.eu/api/v3 (no trailing slash). */
  readonly apiBaseUrl: string;
  /** EU accounts server, e.g. https://accounts.zoho.eu (no trailing slash). */
  readonly accountsBaseUrl: string;
  readonly clientId: string;
  readonly clientSecret: Secret;
  /** The key of the AES-256-GCM envelope that seals tokens at rest. Required: there is no fallback. */
  readonly tokenDekKey: Secret;
  /** At most `WRITE_MARGIN_MS`, so a write started inside its lease ends before the lease does. */
  readonly requestTimeoutMs: number;
  /** Total attempts per call, including the first. */
  readonly maxAttempts: number;
  readonly retryBaseDelayMs: number;
  readonly retryMaxDelayMs: number;
  /** A Retry-After longer than this is returned to the caller instead of waited for. */
  readonly maxRetryAfterMs: number;
  readonly ratePerMinute: number;
  readonly maxConcurrent: number;
  /** The longest a call may queue for a rate or concurrency slot before it is refused locally. */
  readonly maxQueueWaitMs: number;
  readonly dailyCallBudget: number;
  readonly maxResponseBytes: number;
}

/** Only these hosts may ever receive a token: the EU data centre, over https. */
export const ALLOWED_API_HOSTS: readonly string[] = ["books.zoho.eu", "www.zohoapis.eu"];
export const ALLOWED_ACCOUNTS_HOSTS: readonly string[] = ["accounts.zoho.eu"];

export const DEFAULT_API_BASE_URL = "https://books.zoho.eu/api/v3";
export const DEFAULT_ACCOUNTS_BASE_URL = "https://accounts.zoho.eu";

export function validateBaseUrl(
  raw: string,
  allowedHosts: readonly string[],
  name: string,
): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ZohoBooksConfigError(`${name}_invalid`);
  }
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    !allowedHosts.includes(url.hostname)
  ) {
    throw new ZohoBooksConfigError(`${name}_not_allowed`);
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

function required(env: Readonly<Record<string, string | undefined>>, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new ZohoBooksConfigError(`${key.toLowerCase()}_missing`);
  return value;
}

function positiveInt(
  env: Readonly<Record<string, string | undefined>>,
  key: string,
  fallback: number,
  max: number,
): number {
  const raw = env[key]?.trim();
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new ZohoBooksConfigError(`${key.toLowerCase()}_invalid`);
  }
  return value;
}

/**
 * Reads the Books settings from an environment record (the caller passes it; this package never
 * touches `process.env`). Fails closed: a missing client id, secret or token key is an error, and
 * so is a base URL that is not the EU Zoho host over https.
 */
export function parseZohoBooksConfig(
  env: Readonly<Record<string, string | undefined>>,
): ZohoBooksConfig {
  return {
    apiBaseUrl: validateBaseUrl(
      env.ZOHO_BOOKS_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL,
      ALLOWED_API_HOSTS,
      "api_base_url",
    ),
    accountsBaseUrl: validateBaseUrl(
      env.ZOHO_BOOKS_ACCOUNTS_BASE_URL?.trim() || DEFAULT_ACCOUNTS_BASE_URL,
      ALLOWED_ACCOUNTS_HOSTS,
      "accounts_base_url",
    ),
    clientId: required(env, "ZOHO_BOOKS_CLIENT_ID"),
    clientSecret: new Secret(required(env, "ZOHO_BOOKS_CLIENT_SECRET")),
    tokenDekKey: new Secret(required(env, "ZOHO_BOOKS_TOKEN_DEK_KEY")),
    // A write started inside its lease must end before the lease does (`WRITE_MARGIN_MS`).
    requestTimeoutMs: positiveInt(env, "ZOHO_BOOKS_TIMEOUT_MS", 15_000, WRITE_MARGIN_MS),
    maxAttempts: positiveInt(env, "ZOHO_BOOKS_MAX_ATTEMPTS", 3, 6),
    retryBaseDelayMs: positiveInt(env, "ZOHO_BOOKS_RETRY_BASE_MS", 500, 60_000),
    retryMaxDelayMs: positiveInt(env, "ZOHO_BOOKS_RETRY_MAX_MS", 8_000, 300_000),
    maxRetryAfterMs: positiveInt(env, "ZOHO_BOOKS_MAX_RETRY_AFTER_MS", 30_000, 600_000),
    ratePerMinute: positiveInt(env, "ZOHO_BOOKS_RATE_PER_MINUTE", 100, 100),
    maxConcurrent: positiveInt(env, "ZOHO_BOOKS_MAX_CONCURRENT", 5, 5),
    maxQueueWaitMs: positiveInt(env, "ZOHO_BOOKS_MAX_QUEUE_WAIT_MS", 30_000, 600_000),
    dailyCallBudget: positiveInt(env, "ZOHO_BOOKS_DAILY_CALL_BUDGET", 1_000, 1_000_000),
    maxResponseBytes: positiveInt(env, "ZOHO_BOOKS_MAX_RESPONSE_BYTES", 5_000_000, 50_000_000),
  };
}
