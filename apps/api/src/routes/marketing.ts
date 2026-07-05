import { Hono } from "hono";
import { z } from "zod";
import type { ContainerMarketingRoutesSlice } from "../container.js";
import { isMarketingEventsEnabled } from "../lib/marketing-events-enabled.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

const clickIdsBodySchema = z.object({
  fbp: z.string().max(256).optional(),
  fbc: z.string().max(256).optional(),
});

export function createMarketingRoutes(
  container: ContainerMarketingRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const r = new Hono<{ Variables: { userId?: string } }>();

  r.post("/click-ids", requireAuth, zValidator("json", clickIdsBodySchema), async (c) => {
    if (!isMarketingEventsEnabled(container.env)) {
      return c.body(null, 204);
    }
    const userId = c.get("userId") as string;
    const body = c.req.valid("json");
    await container.clickIdStore.put(userId, {
      ...(body.fbp ? { fbp: body.fbp } : {}),
      ...(body.fbc ? { fbc: body.fbc } : {}),
    });
    return c.body(null, 204);
  });

  return r;
}
