export const SESSION_LOOKUP_TRANSIENT_ERROR_NAME = "SessionLookupTransientError";

export class SessionLookupTransientError extends Error {
  readonly status: number | undefined;

  constructor(status?: number) {
    super(
      `[auth] session lookup failed after retries (transient, not 401) status=${status ?? "network"}`,
    );
    this.name = SESSION_LOOKUP_TRANSIENT_ERROR_NAME;
    this.status = status;
  }
}

export function isSessionLookupTransientError(
  error: unknown,
): error is SessionLookupTransientError {
  return (
    error instanceof SessionLookupTransientError ||
    (error instanceof Error && error.name === SESSION_LOOKUP_TRANSIENT_ERROR_NAME)
  );
}
