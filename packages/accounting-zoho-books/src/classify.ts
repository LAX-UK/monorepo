import {
  ZohoAuthError,
  type ZohoBooksError,
  ZohoConflictError,
  ZohoNotFoundError,
  ZohoRateLimitedError,
  ZohoServerError,
  ZohoUnknownError,
  ZohoValidationError,
} from "./errors.js";
import { parseJson, parseRetryAfter } from "./http.js";
import type { TransportResponse } from "./ports.js";

export interface ZohoResponse {
  readonly status: number;
  /** The parsed JSON body, unvalidated: the mappers check its shape. Null when the body is empty. */
  readonly body: unknown;
}

/**
 * Zoho codes that name a refusal the rest of the system must tell apart. 4151: the transaction
 * date is in a period locked in Books, so the document cannot be booked on that date; it ends in
 * the shared `_period_locked` suffix (`@auction/accounting-domain`) so staff see it as such.
 */
const NAMED_ZOHO_CODES: Readonly<Record<number, string>> = { 4151: "period_locked" };

function validationCode(zohoCode: number | undefined, fallback: string): string {
  return (zohoCode !== undefined && NAMED_ZOHO_CODES[zohoCode]) || fallback;
}

function zohoCodeOf(body: unknown): number | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const code = (body as { code?: unknown }).code;
  return typeof code === "number" && Number.isInteger(code) ? code : undefined;
}

/**
 * Turns an HTTP reply into a response or a typed error. The mapping decides what the domain is
 * told: a 4xx means Zoho did not act (`rejected`); a 5xx, an unreadable reply or a redirect means
 * we cannot tell (`unknown`). Provider text is never copied into the error.
 */
export function classifyResponse(
  response: TransportResponse,
  nowMs: number,
): { ok: true; value: ZohoResponse } | { ok: false; error: ZohoBooksError } {
  const { status } = response;
  const parsed = parseJson(response.body);

  if (status >= 200 && status < 300) {
    if (!parsed.ok) {
      return {
        ok: false,
        error: new ZohoUnknownError({ code: "unreadable_response", httpStatus: status }),
      };
    }
    const zohoCode = zohoCodeOf(parsed.value);
    // Zoho reports some failures as HTTP 200 with a non-zero `code` in the body.
    if (zohoCode !== undefined && zohoCode !== 0) {
      return {
        ok: false,
        error: new ZohoValidationError({
          code: validationCode(zohoCode, "rejected_by_zoho"),
          httpStatus: status,
          zohoCode,
        }),
      };
    }
    return { ok: true, value: { status, body: parsed.value } };
  }

  const zohoCode = parsed.ok ? zohoCodeOf(parsed.value) : undefined;
  const base = zohoCode === undefined ? { httpStatus: status } : { httpStatus: status, zohoCode };

  if (status === 401)
    return { ok: false, error: new ZohoAuthError({ code: "unauthorized", ...base }) };
  if (status === 403)
    return { ok: false, error: new ZohoAuthError({ code: "forbidden", ...base }) };
  if (status === 404)
    return { ok: false, error: new ZohoNotFoundError({ code: "not_found", ...base }) };
  if (status === 409)
    return { ok: false, error: new ZohoConflictError({ code: "conflict", ...base }) };
  if (status === 429) {
    const retryAfterMs = parseRetryAfter(response.headers["retry-after"], nowMs);
    return {
      ok: false,
      error: new ZohoRateLimitedError({
        code: "rate_limited",
        ...base,
        ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
      }),
    };
  }
  if (status === 408)
    return { ok: false, error: new ZohoUnknownError({ code: "request_timeout", ...base }) };
  if (status >= 500)
    return { ok: false, error: new ZohoServerError({ code: `http_${status}`, ...base }) };
  if (status >= 300 && status < 400) {
    return { ok: false, error: new ZohoUnknownError({ code: "unexpected_redirect", ...base }) };
  }
  if (status >= 400) {
    return {
      ok: false,
      error: new ZohoValidationError({
        code: validationCode(
          zohoCode,
          status === 400 || status === 422 ? "invalid_request" : `http_${status}`,
        ),
        ...base,
      }),
    };
  }
  return { ok: false, error: new ZohoUnknownError({ code: `http_${status}`, ...base }) };
}
