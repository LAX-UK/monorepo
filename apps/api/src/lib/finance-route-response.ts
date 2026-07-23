import type { Context } from "hono";
import type {
  FinanceHttpJson,
  FinanceRouteOutcome,
  FinanceRouteServiceError,
} from "../services/interfaces/finance-routes/finance-route-http.js";
import { asHttpStatus } from "./http-status.js";

export function respondFinanceRouteOutcome<T>(
  c: Context,
  outcome: FinanceRouteOutcome<T>,
  defaultStatus = 200,
) {
  if (outcome.kind === "err") return respondFinanceError(c, outcome.error);
  return c.json({ data: outcome.data }, (outcome.status ?? defaultStatus) as 200 | 201);
}

export function respondFinanceError(c: Context, error: FinanceRouteServiceError) {
  const body: Record<string, string> = error.code
    ? { error: error.message, code: error.code }
    : { error: error.message };
  return c.json(body, asHttpStatus(error.status));
}

export function respondFinanceHttpJson(c: Context, response: FinanceHttpJson) {
  return c.json(response.body, asHttpStatus(response.status));
}

export function respondFinanceOkBody(c: Context, body: unknown, status = 200) {
  return c.json(body, status as 200 | 201);
}
