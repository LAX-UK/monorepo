import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { isPrimaryLoginCredentialPath } from "./credential-route-policy.js";

/** Credential endpoints are same-origin only; account-management keeps RP origins. */
export function createAuthRouteCorsMiddleware(webOrigins: string[]): MiddlewareHandler {
  const rpCors = cors({
    origin: webOrigins,
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  });
  const sameOriginCors = cors({
    origin: (origin, c) => {
      const issuerOrigin = new URL(c.req.url).origin;
      if (!origin) return issuerOrigin;
      try {
        return new URL(origin).origin === issuerOrigin ? origin : "";
      } catch {
        return "";
      }
    },
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  });

  return async (c, next) => {
    const path = new URL(c.req.url).pathname;
    if (isPrimaryLoginCredentialPath(path)) {
      return sameOriginCors(c, next);
    }
    return rpCors(c, next);
  };
}
