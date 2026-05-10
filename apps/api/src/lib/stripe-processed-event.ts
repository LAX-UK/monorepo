import type { Database } from "@auction/db";
import { processedStripeEvents } from "@auction/db/schema";

/**
 * Idempotent Stripe webhook claim: first insert wins; replays return claimed=false.
 * Use `source` to namespace the same Stripe event id across different handlers if needed.
 */
export async function tryClaimProcessedStripeEvent(
  db: Database,
  eventId: string,
  source: string,
): Promise<{ claimed: boolean }> {
  const [row] = await db
    .insert(processedStripeEvents)
    .values({ eventId, source })
    .onConflictDoNothing({ target: processedStripeEvents.eventId })
    .returning({ eventId: processedStripeEvents.eventId });
  return { claimed: Boolean(row) };
}
