import { MARKETING_CONSENT_MARKETING_HEADER } from "@auction/http-headers";
import {
  marketingAttributionPutBodySchema,
  parseMarketingAttributionSnapshot,
} from "@auction/validators";
import { Hono } from "hono";
import { z } from "zod";
import type { ContainerMarketingRoutesSlice } from "../container.js";
import { recordMarketingAttributionOperation } from "../lib/marketing-attribution-metrics.js";
import {
  isMarketingAttributionEnabled,
  isMarketingEventsEnabled,
} from "../lib/marketing-events-enabled.js";
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

  r.put(
    "/attribution",
    requireAuth,
    zValidator("json", marketingAttributionPutBodySchema),
    async (c) => {
      const enabled = isMarketingAttributionEnabled(container.env);
      if (!enabled) {
        recordMarketingAttributionOperation("sync", "disabled", false);
        return c.body(null, 204);
      }
      if (c.req.header(MARKETING_CONSENT_MARKETING_HEADER) !== "1") {
        recordMarketingAttributionOperation("sync", "rejected", true);
        return c.body(null, 204);
      }
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      const snapshot = parseMarketingAttributionSnapshot(body.snapshot);
      if (!snapshot) {
        return c.json({ error: "invalid_attribution_snapshot" }, 400);
      }
      try {
        await container.attributionStore.put(userId, snapshot);
      } catch (error) {
        recordMarketingAttributionOperation("sync", "failed", true);
        throw error;
      }
      recordMarketingAttributionOperation("sync", "accepted", true);
      return c.body(null, 204);
    },
  );

  r.delete("/attribution", requireAuth, async (c) => {
    const enabled = isMarketingAttributionEnabled(container.env);
    const userId = c.get("userId") as string;
    try {
      await container.attributionStore.delete(userId);
    } catch (error) {
      recordMarketingAttributionOperation("delete", "failed", enabled);
      throw error;
    }
    recordMarketingAttributionOperation("delete", "accepted", enabled);
    return c.body(null, 204);
  });

  return r;
}
