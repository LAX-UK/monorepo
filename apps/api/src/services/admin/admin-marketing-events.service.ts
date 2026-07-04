import type {
  IAdminMarketingEventOutboxRepository,
  MarketingEventOutboxState,
} from "@auction/persistence/interfaces";
import type { adminMarketingEventsReplayBodySchema } from "@auction/validators";
import type { z } from "zod";

const FAILED_ALERT_THRESHOLD = 10;
const FAILED_ALERT_WINDOW_MS = 60 * 60 * 1000;

export type AdminMarketingEventsReplayBody = z.infer<typeof adminMarketingEventsReplayBodySchema>;

export class AdminMarketingEventsService {
  constructor(
    private readonly outbox: IAdminMarketingEventOutboxRepository,
    private readonly sentryDsn: string | undefined,
  ) {}

  async replay(body: AdminMarketingEventsReplayBody) {
    const from = new Date(body.from);
    const to = new Date(body.to);
    const states: MarketingEventOutboxState[] = body.includeFailed
      ? ["pending", "failed"]
      : ["pending"];
    const limit = body.limit ?? 500;
    const names = body.names?.length ? body.names : undefined;

    if (body.dryRun) {
      const total = await this.outbox.countReplayCandidates({ from, to, states, names });
      return { dryRun: true as const, wouldRequeue: Math.min(total, limit), limit };
    }

    const candidateIds = await this.outbox.listReplayCandidateIds({
      from,
      to,
      states,
      names,
      limit,
    });
    if (candidateIds.length === 0) {
      return { requeued: 0, limit };
    }

    const requeued = await this.outbox.requeueByIds(candidateIds);
    return { requeued, limit };
  }

  async stats(days: number) {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await this.outbox.statsSince(since);
    const failedLastHour = await this.outbox.failedLastHour(FAILED_ALERT_WINDOW_MS);

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
