import type { Context } from "hono";
import type { BiddingRouteOutcome } from "../services/interfaces/bidding-routes/bidding-route-http.js";
import { asHttpStatus } from "./http-status.js";

export function respondBiddingRouteOutcome<T>(
  c: Context,
  outcome: BiddingRouteOutcome<T>,
  defaultStatus = 200,
) {
  if (outcome.kind === "err") {
    const e = outcome.error;
    return c.json(
      e.code ? { error: e.message, code: e.code } : { error: e.message },
      asHttpStatus(e.status),
    );
  }
  const status = outcome.status ?? defaultStatus;
  if (outcome.kind === "replay") {
    return c.json({ data: outcome.data }, status as 201);
  }
  return c.json({ data: outcome.data }, status as 200 | 201);
}
