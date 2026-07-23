import type { Context } from "hono";
import type {
  UserHttpJson,
  UserRouteOutcome,
  UserRouteServiceError,
} from "../services/interfaces/user-routes/user-route-http.js";
import { asHttpStatus } from "./http-status.js";

export function respondUserRouteOutcome<T>(
  c: Context,
  outcome: UserRouteOutcome<T>,
  defaultStatus = 200,
) {
  if (outcome.kind === "no_content") return c.body(null, 204);
  if (outcome.kind === "err") return respondUserError(c, outcome.error);
  return c.json({ data: outcome.data }, (outcome.status ?? defaultStatus) as 200 | 201);
}

export function respondUserError(c: Context, error: UserRouteServiceError) {
  const body: Record<string, string> = error.code
    ? { error: error.message, code: error.code }
    : { error: error.message };
  return c.json(body, asHttpStatus(error.status));
}

export function respondUserHttpJson(c: Context, response: UserHttpJson) {
  if (response.status === 204) return c.body(null, 204);
  return c.json(response.body, asHttpStatus(response.status));
}

export function respondUserRawJson(c: Context, body: unknown, status: number) {
  return c.json(body, status as 200 | 201 | 403 | 404 | 409 | 503);
}
