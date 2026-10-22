import { HOSTED_AUTH_MESSAGES as msg } from "./messages.js";

/** Which hosted screen the response belongs to; the same status means different things on each. */
export type AuthFailureContext = "sign-in" | "two-factor" | "other";

/** A follow-up the screen offers next to the message, because the user can fix the problem from here. */
export type AuthFailureAction = "resend-verification" | "start-again";

export type AuthFailure = {
  message: string;
  action?: AuthFailureAction;
};

export type FailedResponse = {
  status: number;
  data: unknown;
  /** Value of the `Retry-After` header (seconds or an HTTP date), when the server sent one. */
  retryAfter?: string | null;
  /** Value of a `RateLimit-Reset` style header (seconds until reset, or a Unix timestamp). */
  rateLimitReset?: string | null;
};

const EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED";
const INVALID_TWO_FACTOR_COOKIE = "INVALID_TWO_FACTOR_COOKIE";
const ACCOUNT_TEMPORARILY_LOCKED = "ACCOUNT_TEMPORARILY_LOCKED";
const INVALID_BACKUP_CODE = "INVALID_BACKUP_CODE";
/** Values above this are Unix timestamps rather than a number of seconds to wait. */
const UNIX_TIMESTAMP_FLOOR_SEC = 1_000_000_000;

/** Throttling and server faults say nothing about the user's input, so every screen reports them the same way. */
export function isTransientFailure(status: number): boolean {
  return status === 429 || status >= 500;
}

function errorCode(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const code = (data as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function retryAfterFromBody(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const value = (data as { retryAfterSec?: unknown }).retryAfterSec;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function secondsFromHeader(value: string | null | undefined, nowMs: number): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    return n >= UNIX_TIMESTAMP_FLOOR_SEC ? n - Math.floor(nowMs / 1000) : n;
  }
  const date = Date.parse(trimmed);
  return Number.isNaN(date) ? null : Math.ceil((date - nowMs) / 1000);
}

/** Seconds the server asked the client to wait, from the headers first and then the response body. */
export function retryAfterSeconds(
  response: FailedResponse,
  nowMs: number = Date.now(),
): number | null {
  const seconds =
    secondsFromHeader(response.retryAfter, nowMs) ??
    secondsFromHeader(response.rateLimitReset, nowMs) ??
    retryAfterFromBody(response.data);
  return seconds !== null && seconds > 0 ? seconds : null;
}

export function rateLimitedMessage(seconds: number | null): string {
  if (seconds === null) return msg.RATE_LIMITED;
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Too many attempts. Try again in ${String(minutes)} ${minutes === 1 ? "minute" : "minutes"}.`;
}

function twoFactorFailure(response: FailedResponse): AuthFailure | null {
  const code = errorCode(response.data);
  if (code === INVALID_TWO_FACTOR_COOKIE) {
    return { message: msg.MFA_CHALLENGE_EXPIRED, action: "start-again" };
  }
  if (code === ACCOUNT_TEMPORARILY_LOCKED) return { message: msg.MFA_LOCKED };
  if (code === INVALID_BACKUP_CODE) return { message: msg.MFA_BACKUP_INVALID };
  if (response.status === 400 || response.status === 401) return { message: msg.MFA_CODE_INVALID };
  return null;
}

/**
 * Turns a failed hosted-auth response into the message the user needs. Order matters: throttling
 * and server faults read the same on every screen and must never be reported as a wrong
 * password or code, which would send people to guess again or to reset a password they know.
 */
export function describeAuthFailure(
  response: FailedResponse,
  context: AuthFailureContext,
  fallback: string,
  nowMs: number = Date.now(),
): AuthFailure {
  if (response.status === 429) {
    const code = errorCode(response.data);
    if (context === "two-factor" && code === ACCOUNT_TEMPORARILY_LOCKED) {
      return { message: msg.MFA_LOCKED };
    }
    return { message: rateLimitedMessage(retryAfterSeconds(response, nowMs)) };
  }
  if (isTransientFailure(response.status)) return { message: msg.SERVER_ERROR };
  if (context === "sign-in") {
    if (response.status === 403 && errorCode(response.data) === EMAIL_NOT_VERIFIED) {
      return { message: msg.EMAIL_NOT_VERIFIED, action: "resend-verification" };
    }
    if (response.status === 400 || response.status === 401) {
      return { message: msg.GENERIC_SIGN_IN };
    }
  }
  if (context === "two-factor") {
    const failure = twoFactorFailure(response);
    if (failure) return failure;
  }
  return { message: fallback };
}
