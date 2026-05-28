import type { ContentfulStatusCode } from "hono/utils/http-status";

const RETRY_ERRORS = new Set([
  "retries_disabled",
  "mutations_disabled_in_prod",
  "rate_limit_exceeded",
  "job_not_found",
  "unknown_queue",
]);

const PAUSE_ERRORS = new Set([
  "pause_not_allowed",
  "mutations_disabled_in_prod",
  "rate_limit_exceeded",
  "unknown_queue",
]);

const RESUME_ERRORS = new Set([
  "pause_not_allowed",
  "mutations_disabled_in_prod",
  "rate_limit_exceeded",
  "unknown_queue",
]);

const REPLAY_ERRORS = new Set([
  "idempotency_confirmation_required",
  "already_replayed",
  "payload_not_available",
  "invalid_payload",
  "dlq_job_not_found",
  "invalid_original_queue",
  "rate_limit_exceeded",
]);

function sanitizeError(err: unknown, allowed: Set<string>, fallback: string): string {
  const message = err instanceof Error ? err.message : fallback;
  return allowed.has(message) ? message : fallback;
}

type QueueErrorResponse = { error: string; status: ContentfulStatusCode };

export function mapRetryError(err: unknown): QueueErrorResponse {
  const error = sanitizeError(err, RETRY_ERRORS, "retry_failed");
  const status: ContentfulStatusCode =
    error === "rate_limit_exceeded"
      ? 429
      : error === "retries_disabled" || error === "mutations_disabled_in_prod"
        ? 403
        : error === "job_not_found"
          ? 404
          : 400;
  return { error, status };
}

export function mapPauseError(err: unknown): QueueErrorResponse {
  const error = sanitizeError(err, PAUSE_ERRORS, "pause_failed");
  const status: ContentfulStatusCode =
    error === "rate_limit_exceeded"
      ? 429
      : error === "pause_not_allowed" || error === "mutations_disabled_in_prod"
        ? 403
        : 400;
  return { error, status };
}

export function mapResumeError(err: unknown): QueueErrorResponse {
  const error = sanitizeError(err, RESUME_ERRORS, "resume_failed");
  const status: ContentfulStatusCode =
    error === "rate_limit_exceeded"
      ? 429
      : error === "pause_not_allowed" || error === "mutations_disabled_in_prod"
        ? 403
        : 400;
  return { error, status };
}

export function mapReplayError(err: unknown): QueueErrorResponse {
  const error = sanitizeError(err, REPLAY_ERRORS, "replay_failed");
  const status: ContentfulStatusCode =
    error === "rate_limit_exceeded"
      ? 429
      : error === "already_replayed"
        ? 409
        : error === "dlq_job_not_found"
          ? 404
          : 400;
  return { error, status };
}
