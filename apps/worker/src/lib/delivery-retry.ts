import { DomainEventContractError } from "@auction/types";

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
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/** Classify outbound delivery failures for retry vs dead-letter. */
export function classifyDeliveryError(err: unknown): DeliveryErrorClass {
  if (err instanceof DomainEventContractError) return "fatal";

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
};

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
  return Math.max(baseMs, Math.round(jitter));
}

export function formatDeliveryError(err: unknown): string {
  return errorMessage(err);
}
