import {
  adminMarketingEventsReplayBodySchema,
  adminMarketingEventsStatsQuerySchema,
} from "@auction/validators";
import type { Hono } from "hono";
import type { ContainerAdminMarketingEventsRoutesSlice } from "../container.js";
import { isMarketingEventsEnabled } from "../lib/marketing-events-enabled.js";
import { zValidator } from "../lib/z-validator.js";

export function attachAdminMarketingEventsRoutes(
  platform: Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>,
  container: ContainerAdminMarketingEventsRoutesSlice,
) {
  platform.post(
    "/marketing-events/replay",
    zValidator("json", adminMarketingEventsReplayBodySchema),
    async (c) => {
      if (!isMarketingEventsEnabled(container.env)) {
        return c.json({ error: "marketing_events_disabled" }, 503);
      }
      const body = c.req.valid("json");
      const result = await container.admin.marketingEvents.replay(body);
      return c.json(result);
    },
  );

  platform.get(
    "/marketing-events/stats",
    zValidator("query", adminMarketingEventsStatsQuerySchema),
    async (c) => {
      if (!isMarketingEventsEnabled(container.env)) {
        return c.json({ error: "marketing_events_disabled" }, 503);
      }
      const { days } = c.req.valid("query");
      const data = await container.admin.marketingEvents.stats(days);
      return c.json({ data });
    },
  );
}
