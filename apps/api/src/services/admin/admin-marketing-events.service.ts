import type { Database } from "@auction/db";
import { marketingEventOutbox } from "@auction/db/schema";
import type { adminMarketingEventsReplayBodySchema } from "@auction/validators";
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { z } from "zod";

const FAILED_ALERT_THRESHOLD = 10;
const FAILED_ALERT_WINDOW_MS = 60 * 60 * 1000;

export type AdminMarketingEventsReplayBody = z.infer<typeof adminMarketingEventsReplayBodySchema>;

export class AdminMarketingEventsService {
  constructor(
    private readonly db: Database,
    private readonly sentryDsn: string | undefined,
  ) {}

  async replay(body: AdminMarketingEventsReplayBody) {
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
      const countRows = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(marketingEventOutbox)
        .where(and(...conditions));
      const total = countRows[0]?.count ?? 0;
      return { dryRun: true as const, wouldRequeue: Math.min(total, limit), limit };
    }

    const candidateIds = await this.db
      .select({ id: marketingEventOutbox.id })
      .from(marketingEventOutbox)
      .where(and(...conditions))
      .orderBy(asc(marketingEventOutbox.createdAt))
      .limit(limit);

    if (candidateIds.length === 0) {
      return { requeued: 0, limit };
    }

    const updated = await this.db
      .update(marketingEventOutbox)
      .set({ state: "pending", attempts: 0, lastError: null, sentAt: null, claimedAt: null })
      .where(
        inArray(
          marketingEventOutbox.id,
          candidateIds.map((r) => r.id),
        ),
      )
      .returning({ id: marketingEventOutbox.id });

    return { requeued: updated.length, limit };
  }

  async stats(days: number) {
    const since = new Date(Date.now() - days * 86_400_000);

    const rows = await this.db
      .select({
        name: marketingEventOutbox.name,
        state: marketingEventOutbox.state,
        count: sql<number>`count(*)::int`,
      })
      .from(marketingEventOutbox)
      .where(gte(marketingEventOutbox.createdAt, since))
      .groupBy(marketingEventOutbox.name, marketingEventOutbox.state);

    const failedLastHour = await this.db
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

    if (this.sentryDsn) {
      for (const row of failedLastHour) {
        if (row.count >= FAILED_ALERT_THRESHOLD) {
          const { Sentry } = await import("@auction/observability");
          Sentry.captureMessage(`marketing_events_failed_spike:${row.name}`, {
            level: "warning",
            extra: { name: row.name, count: row.count, windowMs: FAILED_ALERT_WINDOW_MS },
          });
        }
      }
    }

    return {
      since: since.toISOString(),
      byNameAndState: rows,
      failedLastHour,
    };
  }
}
