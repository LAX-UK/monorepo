import type { ZodError } from "zod";

export const VALIDATION_FAILED_ERROR_CODE = "validation_failed" as const;

export type ApiErrorBody = {
  error?: unknown;
  errorCode?: string;
  code?: string;
};

function isZodErrorLike(error: object): error is Pick<ZodError, "issues"> {
  return "issues" in error && Array.isArray(error.issues);
}

/** First human-readable message from a Zod validation failure (API responses). */
export function formatZodValidationError(error: Pick<ZodError, "issues">): string {
  const first = error.issues[0]?.message?.trim();
  return first && first.length > 0 ? first : "Invalid request.";
}

/** Standard 400 body for zValidator failures. */
export function buildValidationFailedBody(error: Pick<ZodError, "issues">): {
  error: string;
  errorCode: typeof VALIDATION_FAILED_ERROR_CODE;
} {
  return {
    error: formatZodValidationError(error),
    errorCode: VALIDATION_FAILED_ERROR_CODE,
  };
}

/** Normalize API `error` payloads for UI display (string codes, Zod objects, `{ message }`). */
export function normalizeApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") {
    return error.length > 0 ? error : fallback;
  }

  if (error && typeof error === "object") {
    if (isZodErrorLike(error)) {
      return formatZodValidationError(error);
    }
    if ("message" in error && typeof error.message === "string") {
      const message = error.message.trim();
      if (message.length > 0) return message;
    }
  }

  return fallback;
}

/** Machine-readable code from an API error body (`errorCode`, `code`, or legacy shapes). */
export function parseApiErrorCodeFromBody(body: ApiErrorBody): string | null {
  if (typeof body.errorCode === "string" && body.errorCode.length > 0) return body.errorCode;
  if (typeof body.code === "string" && body.code.length > 0) return body.code;
  if (typeof body.error === "string" && body.error.length > 0) return body.error;
  if (body.error && typeof body.error === "object" && isZodErrorLike(body.error)) {
    return VALIDATION_FAILED_ERROR_CODE;
  }
  return null;
}
