/** Mirrors @auction/validators API error helpers — kept local so the static microsite Docker build stays self-contained. */

export type ApiErrorBody = {
  error?: unknown;
  errorCode?: string;
  code?: string;
};

function isZodErrorLike(error: object): error is { issues: Array<{ message?: string }> } {
  return "issues" in error && Array.isArray(error.issues);
}

export function normalizeApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") {
    return error.length > 0 ? error : fallback;
  }

  if (error && typeof error === "object") {
    if (isZodErrorLike(error)) {
      const first = error.issues[0]?.message?.trim();
      return first && first.length > 0 ? first : fallback;
    }
    if ("message" in error && typeof error.message === "string") {
      const message = error.message.trim();
      if (message.length > 0) return message;
    }
  }

  return fallback;
}

export function parseApiErrorCodeFromBody(body: ApiErrorBody): string | null {
  if (typeof body.errorCode === "string" && body.errorCode.length > 0) return body.errorCode;
  if (typeof body.code === "string" && body.code.length > 0) return body.code;
  if (typeof body.error === "string" && body.error.length > 0) return body.error;
  if (body.error && typeof body.error === "object" && isZodErrorLike(body.error)) {
    return "validation_failed";
  }
  return null;
}
