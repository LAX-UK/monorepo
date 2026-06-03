import type { Database } from "@auction/db";
import { domainEvent } from "@auction/db/schema";

export type PublishUserEmailVerifiedInput = {
  userId: string;
  email: string;
};

/** Emits `user.email_verified` for the worker marketing-contacts projector. */
export async function publishUserEmailVerified(
  db: Database,
  input: PublishUserEmailVerifiedInput,
): Promise<void> {
  const now = new Date();
  await db.insert(domainEvent).values({
    aggregateType: "user",
    aggregateId: input.userId,
    eventType: "user.email_verified",
    producer: "apps/auth",
    payload: {
      userId: input.userId,
      email: input.email,
      verifiedAt: now.toISOString(),
    },
    actorUserId: input.userId,
    schemaVersion: 1,
  });
}
