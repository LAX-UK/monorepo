import { INVENTORY_MACHINE_HEADERS } from "@auction/artwork-register-contracts";
import type { MiddlewareHandler } from "hono";
import type { Env } from "../env.js";
import { timingSafeSecretMatches } from "../lib/internal-cron-auth.js";

type InventoryMachineEnv = Pick<
  Env,
  "INVENTORY_MACHINE_CLIENT_ID" | "INVENTORY_MACHINE_CLIENT_SECRET"
>;

/** Only LAX Shop, holding the shared inventory credential, may use the machine routes. */
export function createInventoryMachineAuth(env: InventoryMachineEnv): MiddlewareHandler {
  return async (c, next) => {
    if (!env.INVENTORY_MACHINE_CLIENT_ID || !env.INVENTORY_MACHINE_CLIENT_SECRET) {
      return c.json(
        { error: "not_configured", message: "Moving artworks between products is not set up." },
        503,
      );
    }
    if (
      !timingSafeSecretMatches(
        c.req.header(INVENTORY_MACHINE_HEADERS.clientId),
        env.INVENTORY_MACHINE_CLIENT_ID,
      ) ||
      !timingSafeSecretMatches(
        c.req.header(INVENTORY_MACHINE_HEADERS.clientSecret),
        env.INVENTORY_MACHINE_CLIENT_SECRET,
      )
    ) {
      return c.json({ error: "unauthorized" }, 401);
    }
    await next();
  };
}
