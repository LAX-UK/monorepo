import type { Database } from "@auction/db";
import { webhookEvent } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { IWebhookEventRepository } from "../interfaces/webhook-event.repository.js";

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

  async markProcessed(eventKey: string): Promise<void> {
    await this.db
      .update(webhookEvent)
      .set({ processedAt: new Date(), lastError: null })
      .where(eq(webhookEvent.eventKey, eventKey));
  }

  async markFailed(eventKey: string, error: string): Promise<void> {
    await this.db
      .update(webhookEvent)
      .set({
        processedAt: new Date(),
        lastError: error,
      })
      .where(eq(webhookEvent.eventKey, eventKey));
  }
}
