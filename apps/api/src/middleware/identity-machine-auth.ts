import type { MiddlewareHandler } from "hono";
import type { Env } from "../env.js";
import { timingSafeSecretMatches } from "../lib/internal-cron-auth.js";

type IdentityMachineEnv = Pick<
  Env,
  "IDENTITY_MACHINE_CLIENT_ID" | "IDENTITY_MACHINE_CLIENT_SECRET"
>;

export function createIdentityMachineAuth(env: IdentityMachineEnv): MiddlewareHandler {
  return async (c, next) => {
    if (!env.IDENTITY_MACHINE_CLIENT_ID || !env.IDENTITY_MACHINE_CLIENT_SECRET) {
      return c.json({ error: "identity_machine_not_configured" }, 503);
    }
    if (
      !timingSafeSecretMatches(
        c.req.header("x-identity-client-id"),
        env.IDENTITY_MACHINE_CLIENT_ID,
      ) ||
      !timingSafeSecretMatches(
        c.req.header("x-identity-client-secret"),
        env.IDENTITY_MACHINE_CLIENT_SECRET,
      )
    ) {
      return c.json({ error: "unauthorized" }, 401);
    }
    await next();
  };
}
