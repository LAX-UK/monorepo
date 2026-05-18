import { marketingEventOutbox } from "@auction/db/schema";
import {
  adminMarketingEventsReplayBodySchema,
  adminMarketingEventsStatsQuerySchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { Hono } from "hono";
import type { Container } from "../container.js";
import { isMarketingEventsEnabled } from "../lib/marketing-events-enabled.js";

const FAILED_ALERT_THRESHOLD = 10;
const FAILED_ALERT_WINDOW_MS = 60 * 60 * 1000;

export function attachAdminMarketingEventsRoutes(
  platform: Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>,
  container: Container,
) {
  platform.post(
    "/marketing-events/replay",
    zValidator("json", adminMarketingEventsReplayBodySchema),
    async (c) => {
      if (!isMarketingEventsEnabled(container.env)) {
        return c.json({ error: "marketing_events_disabled" }, 503);
      }
      const body = c.req.valid("json");
      const from = new Date(body.from);
      const to = new Date(body.to);
      const states = body.includeFailed ? (["pending", "failed"] as const) : (["pending"] as const);

      const limit = body.limit ?? 500;
      const conditions = [
        gte(marketingEventOutbox.createdAt, from),
        lte(marketingEventOutbox.createdAt, to),
        inArray(marketingEventOutbox.state, [...states]),
      ];
      if (body.names?.length) {
        conditions.push(inArray(marketingEventOutbox.name, body.names));
      }

      if (body.dryRun) {
        const countRows = await container.db
          .select({ count: sql<number>`count(*)::int` })
          .from(marketingEventOutbox)
          .where(and(...conditions));
        const total = countRows[0]?.count ?? 0;
        return c.json({ dryRun: true, wouldRequeue: Math.min(total, limit), limit });
      }

      const candidateIds = await container.db
        .select({ id: marketingEventOutbox.id })
        .from(marketingEventOutbox)
        .where(and(...conditions))
        .orderBy(asc(marketingEventOutbox.createdAt))
        .limit(limit);

      if (candidateIds.length === 0) {
        return c.json({ requeued: 0, limit });
      }

      const updated = await container.db
        .update(marketingEventOutbox)
        .set({ state: "pending", attempts: 0, lastError: null, sentAt: null, claimedAt: null })
        .where(
          inArray(
            marketingEventOutbox.id,
            candidateIds.map((r) => r.id),
          ),
        )
        .returning({ id: marketingEventOutbox.id });

      return c.json({ requeued: updated.length, limit });
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
      const since = new Date(Date.now() - days * 86_400_000);

      const rows = await container.db
        .select({
          name: marketingEventOutbox.name,
          state: marketingEventOutbox.state,
          count: sql<number>`count(*)::int`,
        })
        .from(marketingEventOutbox)
        .where(gte(marketingEventOutbox.createdAt, since))
        .groupBy(marketingEventOutbox.name, marketingEventOutbox.state);

      const failedLastHour = await container.db
        .select({
          name: marketingEventOutbox.name,
          count: sql<number>`count(*)::int`,
        })
        .from(marketingEventOutbox)
        .where(
          and(
            eq(marketingEventOutbox.state, "failed"),
            gte(marketingEventOutbox.createdAt, new Date(Date.now() - FAILED_ALERT_WINDOW_MS)),
          ),
        )
        .groupBy(marketingEventOutbox.name);

      for (const row of failedLastHour) {
        if (row.count >= FAILED_ALERT_THRESHOLD && container.env.SENTRY_DSN_API) {
          const Sentry = await import("@sentry/node");
          Sentry.captureMessage(`marketing_events_failed_spike:${row.name}`, {
            level: "warning",
            extra: { name: row.name, count: row.count, windowMs: FAILED_ALERT_WINDOW_MS },
          });
        }
      }

      return c.json({
        data: {
          since: since.toISOString(),
          byNameAndState: rows,
          failedLastHour,
        },
      });
    },
  );
}
