import type { Database } from "@auction/db";
import { processedWebhookEvents } from "@auction/db/schema";

/** Idempotent webhook claim: first insert wins; replays return claimed=false. */
export async function tryClaimProcessedWebhookEvent(
  db: Database,
  eventId: string,
  source: string,
): Promise<{ claimed: boolean }> {
  const [row] = await db
    .insert(processedWebhookEvents)
    .values({ eventId, source })
    .onConflictDoNothing({ target: processedWebhookEvents.eventId })
    .returning({ eventId: processedWebhookEvents.eventId });
  return { claimed: Boolean(row) };
}
