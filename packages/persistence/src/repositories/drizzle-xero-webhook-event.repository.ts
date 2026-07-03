import type { Database } from "@auction/db";
import { xeroWebhookEvent } from "@auction/db/schema";
import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import type { IXeroWebhookEventRepository } from "../interfaces/xero.repository.js";

export class DrizzleXeroWebhookEventRepository implements IXeroWebhookEventRepository {
  constructor(private readonly db: Database) {}

  async tryClaimEvent(input: {
    tenantId: string;
    resourceType: string;
    resourceId: string;
    eventKey: string;
  }): Promise<{ claimed: boolean }> {
    const [row] = await this.db
      .insert(xeroWebhookEvent)
      .values({
        tenantId: input.tenantId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        eventKey: input.eventKey,
        createdAt: new Date(),
      })
      .onConflictDoNothing({ target: [xeroWebhookEvent.eventKey] })
      .returning({ id: xeroWebhookEvent.id });
    return { claimed: Boolean(row) };
  }

  async markProcessed(eventKey: string): Promise<void> {
    await this.db
      .update(xeroWebhookEvent)
      .set({ processedAt: new Date(), error: null })
      .where(eq(xeroWebhookEvent.eventKey, eventKey));
  }

  async markFailed(eventKey: string, error: string): Promise<void> {
    await this.db
      .update(xeroWebhookEvent)
      .set({ error, processedAt: new Date() })
      .where(eq(xeroWebhookEvent.eventKey, eventKey));
  }

  async countErrorsSince(since: Date): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(xeroWebhookEvent)
      .where(and(isNotNull(xeroWebhookEvent.error), gte(xeroWebhookEvent.createdAt, since)));
    return row?.count ?? 0;
  }

  async listRecentFailures(limit: number) {
    return this.db
      .select({
        tenantId: xeroWebhookEvent.tenantId,
        resourceId: xeroWebhookEvent.resourceId,
        eventKey: xeroWebhookEvent.eventKey,
      })
      .from(xeroWebhookEvent)
      .where(isNotNull(xeroWebhookEvent.error))
      .orderBy(desc(xeroWebhookEvent.createdAt))
      .limit(limit);
  }
}
