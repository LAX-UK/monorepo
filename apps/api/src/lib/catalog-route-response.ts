import type { Context } from "hono";
import type { CatalogHttpJson } from "../services/interfaces/catalog-routes/catalog-read-http.js";
import type { CatalogRouteOutcome } from "../services/interfaces/catalog-routes/catalog-route-http.js";
import { serviceErrorJsonBody } from "./forbidden-response.js";
import { asHttpStatus } from "./http-status.js";

export function respondCatalogHttpJson(c: Context, response: CatalogHttpJson) {
  return c.json(response.body, asHttpStatus(response.status));
}

export function respondCatalogRouteOutcome<T>(
  c: Context,
  outcome: CatalogRouteOutcome<T>,
  defaultStatus = 200,
) {
  if (outcome.kind === "no_content") return c.body(null, 204);
  if (outcome.kind === "err") {
    return c.json(serviceErrorJsonBody(outcome.error), asHttpStatus(getErrorStatus(outcome.error)));
  }
  return c.json({ data: outcome.data }, (outcome.status ?? defaultStatus) as 200 | 201);
}

function getErrorStatus(error: Error): number {
  if ("status" in error && typeof error.status === "number") return error.status;
  return 500;
}
