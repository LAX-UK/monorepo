import type { Database } from "@auction/db";
import { webhookEvent } from "@auction/db/schema";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import type {
  IWebhookEventRepository,
  WebhookEventDrainRow,
} from "../interfaces/webhook-event.repository.js";

const DEFAULT_MAX_ATTEMPTS = 10;

function mapDrainRow(row: typeof webhookEvent.$inferSelect): WebhookEventDrainRow {
  return {
    eventKey: row.eventKey,
    source: row.source,
    payload: row.payload,
    attempts: row.attempts,
  };
}

export class DrizzleWebhookEventRepository implements IWebhookEventRepository {
  constructor(private readonly db: Database) {}

  async tryClaimEvent(input: {
    source: string;
    eventKey: string;
    payload: unknown;
  }): Promise<{ claimed: boolean }> {
    const [row] = await this.db
      .insert(webhookEvent)
      .values({
        source: input.source,
        eventKey: input.eventKey,
        payload: input.payload,
        receivedAt: new Date(),
      })
      .onConflictDoNothing({ target: webhookEvent.eventKey })
      .returning({ id: webhookEvent.id });
    return { claimed: Boolean(row) };
  }

  async tryClaimForProcessing(
    eventKey: string,
    leaseMs: number,
  ): Promise<{ claimed: boolean; row: WebhookEventDrainRow | null }> {
    const now = new Date();
    const claimExpiresAt = new Date(now.getTime() + leaseMs);
    const [row] = await this.db
      .update(webhookEvent)
      .set({
        claimExpiresAt,
        attempts: sql`${webhookEvent.attempts} + 1`,
      })
      .where(
        and(
          eq(webhookEvent.eventKey, eventKey),
          isNull(webhookEvent.processedAt),
          lt(webhookEvent.attempts, DEFAULT_MAX_ATTEMPTS),
          or(isNull(webhookEvent.claimExpiresAt), lt(webhookEvent.claimExpiresAt, now)),
        ),
      )
      .returning();
    if (!row) return { claimed: false, row: null };
    return { claimed: true, row: mapDrainRow(row) };
  }

  async listUnprocessedForDrain(limit: number): Promise<WebhookEventDrainRow[]> {
    const now = new Date();
    const rows = await this.db
      .select()
      .from(webhookEvent)
      .where(
        and(
          isNull(webhookEvent.processedAt),
          lt(webhookEvent.attempts, DEFAULT_MAX_ATTEMPTS),
          or(isNull(webhookEvent.claimExpiresAt), lt(webhookEvent.claimExpiresAt, now)),
        ),
      )
      .orderBy(webhookEvent.receivedAt)
      .limit(limit);
    return rows.map(mapDrainRow);
  }

  async recoverStaleClaims(now: Date = new Date()): Promise<number> {
    const updated = await this.db
      .update(webhookEvent)
      .set({ claimExpiresAt: null })
      .where(
        and(
          isNull(webhookEvent.processedAt),
          sql`${webhookEvent.claimExpiresAt} IS NOT NULL`,
          lt(webhookEvent.claimExpiresAt, now),
        ),
      )
      .returning({ id: webhookEvent.id });
    return updated.length;
  }

  async markProcessed(eventKey: string): Promise<void> {
    await this.db
      .update(webhookEvent)
      .set({
        processedAt: new Date(),
        lastError: null,
        claimExpiresAt: null,
      })
      .where(eq(webhookEvent.eventKey, eventKey));
  }

  async markFailed(eventKey: string, error: string): Promise<void> {
    await this.db
      .update(webhookEvent)
      .set({
        lastError: error,
        claimExpiresAt: null,
      })
      .where(eq(webhookEvent.eventKey, eventKey));
  }
}
