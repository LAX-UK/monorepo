/**
 * What went wrong with a Zoho Books call, in the terms the domain needs.
 *
 * Every error says whether the request may have taken effect (`certainty`):
 * - `rejected`: Zoho did not act on it (or it was never sent). Safe to treat as "did not happen".
 * - `unknown`: it may have happened (timeout, connection reset, 5xx, unreadable reply). The domain
 *   must look the document up by its reference before trying again.
 *
 * Messages are fixed codes. Nothing Zoho sends back (message text, names, addresses) is put in an
 * error, so an error is always safe to log and to show to staff.
 */
export type ZohoErrorKind =
  | "auth"
  | "rate_limited"
  | "validation"
  | "not_found"
  | "conflict"
  | "server"
  | "network"
  | "unknown"
  | "budget_exhausted"
  | "fenced";

export type ZohoCertainty = "rejected" | "unknown";

export interface ZohoErrorInit {
  /** A short snake_case code, never provider text. */
  readonly code: string;
  readonly httpStatus?: number;
  /** Zoho's numeric `code` from the response body, when it gave one. */
  readonly zohoCode?: number;
  readonly retryAfterMs?: number;
}

export abstract class ZohoBooksError extends Error {
  abstract readonly kind: ZohoErrorKind;
  abstract readonly certainty: ZohoCertainty;
  readonly code: string;
  readonly httpStatus: number | undefined;
  readonly zohoCode: number | undefined;
  readonly retryAfterMs: number | undefined;

  protected constructor(name: string, init: ZohoErrorInit) {
    super(`${name}:${init.code}`);
    this.name = name;
    this.code = init.code;
    this.httpStatus = init.httpStatus;
    this.zohoCode = init.zohoCode;
    this.retryAfterMs = init.retryAfterMs;
  }

  /** A stable, safe description: `zoho_books_<kind>_<code>`. */
  get reason(): string {
    return `zoho_books_${this.kind}_${this.code}`;
  }
}

/** The token was refused or cannot be had. `reauth_required` means staff must reconnect the org. */
export class ZohoAuthError extends ZohoBooksError {
  readonly kind = "auth";
  readonly certainty = "rejected";
  constructor(init: ZohoErrorInit) {
    super("ZohoAuthError", init);
  }
  get needsReauth(): boolean {
    return this.code === "reauth_required";
  }
}

/** Zoho said 429, or the local limiter could not give a slot in time (`source: "local"`). */
export class ZohoRateLimitedError extends ZohoBooksError {
  readonly kind = "rate_limited";
  readonly certainty = "rejected";
  readonly source: "remote" | "local";
  constructor(init: ZohoErrorInit & { source?: "remote" | "local" }) {
    super("ZohoRateLimitedError", init);
    this.source = init.source ?? "remote";
  }
}

export class ZohoValidationError extends ZohoBooksError {
  readonly kind = "validation";
  readonly certainty = "rejected";
  constructor(init: ZohoErrorInit) {
    super("ZohoValidationError", init);
  }
}

export class ZohoNotFoundError extends ZohoBooksError {
  readonly kind = "not_found";
  readonly certainty = "rejected";
  constructor(init: ZohoErrorInit) {
    super("ZohoNotFoundError", init);
  }
}

export class ZohoConflictError extends ZohoBooksError {
  readonly kind = "conflict";
  readonly certainty = "rejected";
  constructor(init: ZohoErrorInit) {
    super("ZohoConflictError", init);
  }
}

/** Zoho answered 5xx: it may or may not have acted. */
export class ZohoServerError extends ZohoBooksError {
  readonly kind = "server";
  readonly certainty = "unknown";
  constructor(init: ZohoErrorInit) {
    super("ZohoServerError", init);
  }
}

/** No usable answer: timeout or a connection failure after the request may have left. */
export class ZohoNetworkError extends ZohoBooksError {
  readonly kind = "network";
  readonly certainty = "unknown";
  constructor(init: ZohoErrorInit) {
    super("ZohoNetworkError", init);
  }
}

/** Anything else we cannot classify (unreadable reply, redirect, a bug): assume it may have happened. */
export class ZohoUnknownError extends ZohoBooksError {
  readonly kind = "unknown";
  readonly certainty = "unknown";
  constructor(init: ZohoErrorInit) {
    super("ZohoUnknownError", init);
  }
}

/** The daily call budget is spent (or could not be checked): nothing was sent. */
export class ZohoBudgetExhaustedError extends ZohoBooksError {
  readonly kind = "budget_exhausted";
  readonly certainty = "rejected";
  constructor(init: ZohoErrorInit) {
    super("ZohoBudgetExhaustedError", init);
  }
}

export function isZohoBooksError(value: unknown): value is ZohoBooksError {
  return value instanceof ZohoBooksError;
}

/** What a client call returns: errors are values, so a caller cannot forget to handle one. */
export type ZohoResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ZohoBooksError };

export function zohoOk<T>(value: T): ZohoResult<T> {
  return { ok: true, value };
}

export function zohoFail<T = never>(error: ZohoBooksError): ZohoResult<T> {
  return { ok: false, error };
}

/**
 * A write the caller's fence refused just before it would have been sent (the send lost its lease,
 * or has too little of it left): never sent, so `rejected`, and passing (the document is looked
 * after by whoever holds it next).
 */
export class ZohoFencedError extends ZohoBooksError {
  readonly kind = "fenced";
  readonly certainty = "rejected";
  constructor(init: ZohoErrorInit) {
    super("ZohoFencedError", init);
  }
}
