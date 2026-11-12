import type { Database } from "@auction/db";
import { artworkRegisterEvent as event } from "@auction/db/schema";
import { desc, eq } from "drizzle-orm";
import type { RegisterActor, RegisterEventType } from "../../interfaces/artwork-register.js";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Adds one entry to a record's history. History is read in time order, so each entry is stamped
 * strictly after the one before it, even when the caller's clock repeats or steps back.
 */
export async function appendRegisterEvent(
  tx: Tx,
  input: {
    registerId: string;
    type: RegisterEventType;
    actor: RegisterActor;
    now: Date;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  const [latest] = await tx
    .select({ createdAt: event.createdAt })
    .from(event)
    .where(eq(event.registerId, input.registerId))
    .orderBy(desc(event.createdAt))
    .limit(1);
  const createdAt =
    latest && latest.createdAt.getTime() >= input.now.getTime()
      ? new Date(latest.createdAt.getTime() + 1)
      : input.now;
  await tx.insert(event).values({
    registerId: input.registerId,
    type: input.type,
    actor: input.actor,
    payload: input.payload,
    createdAt,
  });
}
