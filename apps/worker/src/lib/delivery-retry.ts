import { DomainEventContractError } from "@auction/types";
import { CrmGatewayError } from "../integrations/crm/crm-gateway-error.js";

export type DeliveryErrorClass = "retryable" | "fatal";

const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "unknown_error";
}

function httpStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const status =
    (err as { status?: unknown; statusCode?: unknown }).status ??
    (err as { statusCode?: unknown }).statusCode;
  return typeof status === "number" ? status : undefined;
}

function errorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const direct = (err as { code?: unknown }).code;
  if (typeof direct === "string") return direct;
  const cause = (err as { cause?: unknown }).cause;
  if (typeof cause === "object" && cause !== null) {
    const nested = (cause as { code?: unknown }).code;
    if (typeof nested === "string") return nested;
  }
  return undefined;
}

export function isRetryableDeliveryError(err: unknown): boolean {
  return (
    typeof err === "object" && err !== null && (err as { retryable?: boolean }).retryable === true
  );
}

/** Classify outbound delivery failures for retry vs dead-letter. */
export function classifyDeliveryError(err: unknown): DeliveryErrorClass {
  if (err instanceof CrmGatewayError && !err.retryable) {
    return "fatal";
  }
  if (isRetryableDeliveryError(err)) {
    return "retryable";
  }
  if (typeof DomainEventContractError === "function" && err instanceof DomainEventContractError) {
    return "fatal";
  }
  if (err instanceof Error && err.name === "DomainEventContractError") {
    return "fatal";
  }

  const message = errorMessage(err).toLowerCase();
  const code = errorCode(err)?.toLowerCase();
  const status = httpStatus(err);

  if (status !== undefined && RETRYABLE_HTTP_STATUSES.has(status)) return "retryable";
  if (code && ["etimedout", "econnreset", "econnrefused", "enotfound"].includes(code)) {
    return "retryable";
  }
  if (
    message.includes("timeout") ||
    message.includes("rate limit") ||
    message.includes("temporarily unavailable")
  ) {
    return "retryable";
  }
  return "fatal";
}

export type DeliveryBackoffOptions = {
  baseMs?: number;
  maxMs?: number;
  jitterRatio?: number;
  /** Minimum delay (e.g. from Retry-After). */
  floorMs?: number;
};

/** Read Retry-After style delay from errors (including CrmGatewayError and cause chain). */
export function readRetryAfterMs(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const direct = (err as { retryAfterMs?: unknown }).retryAfterMs;
  if (typeof direct === "number" && direct >= 0) return direct;
  const cause = (err as { cause?: unknown }).cause;
  if (typeof cause === "object" && cause !== null) {
    const nested = (cause as { retryAfterMs?: unknown }).retryAfterMs;
    if (typeof nested === "number" && nested >= 0) return nested;
  }
  return undefined;
}

export function isCircuitOpenDeliveryError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const message = errorMessage(err);
  if (message === "zoho_crm_circuit_open") return true;
  const code = (err as { code?: unknown }).code;
  return code === "circuit_open";
}

/** Exponential backoff with full jitter (AWS-style). */
export function computeDeliveryBackoffMs(
  attempt: number,
  options: DeliveryBackoffOptions = {},
): number {
  const baseMs = options.baseMs ?? 1_000;
  const maxMs = options.maxMs ?? 15 * 60_000;
  const jitterRatio = options.jitterRatio ?? 1;
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  const jitter = exp * jitterRatio * Math.random();
  const withJitter = Math.max(baseMs, Math.round(jitter));
  const floorMs = options.floorMs ?? 0;
  return Math.min(maxMs, Math.max(withJitter, floorMs));
}

export function formatDeliveryError(err: unknown): string {
  return errorMessage(err);
}
