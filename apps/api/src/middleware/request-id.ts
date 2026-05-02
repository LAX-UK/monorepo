import { randomUUID } from "node:crypto";
import { createMiddleware } from "hono/factory";
import { runWithRequestContext } from "../lib/request-context.js";

const REQUEST_ID_HEADER = "x-request-id";

export function createRequestIdMiddleware() {
  return createMiddleware(async (c, next) => {
    const requestId = c.req.header(REQUEST_ID_HEADER) ?? randomUUID();
    c.header(REQUEST_ID_HEADER, requestId);
    await runWithRequestContext({ requestId }, next);
  });
}
