import type { Context } from "hono";
import type {
  IdentityHttpJson,
  IdentityRouteOutcome,
  IdentityRouteServiceError,
} from "../services/interfaces/identity-routes/identity-route-http.js";
import { asHttpStatus } from "./http-status.js";

export function respondIdentityRouteOutcome<T>(
  c: Context,
  outcome: IdentityRouteOutcome<T>,
  defaultStatus = 200,
) {
  if (outcome.kind === "no_content") return c.body(null, 204);
  if (outcome.kind === "err") {
    return respondIdentityError(c, outcome.error);
  }
  return c.json({ data: outcome.data }, (outcome.status ?? defaultStatus) as 200 | 201);
}

export function respondIdentityError(c: Context, error: IdentityRouteServiceError) {
  const body: Record<string, string> = error.code
    ? { error: error.message, code: error.code }
    : { error: error.message };
  if (error.hint) body.message = error.hint;
  return c.json(body, asHttpStatus(error.status));
}

export function respondIdentityRawJson(c: Context, body: unknown, status: number) {
  return c.json(body, status as 200 | 201 | 403 | 404 | 503);
}

export function respondIdentityHttpJson(c: Context, response: IdentityHttpJson) {
  if (response.status === 204) return c.body(null, 204);
  return c.json(response.body, asHttpStatus(response.status));
}
