import type { Database } from "@auction/db";
import { domainEvent } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";

export type PublishUserEmailVerifiedInput = {
  userId: string;
  email: string;
};

/** Emits `user.email_verified` for the worker marketing-contacts projector.
 *
 * Idempotent: the magic-link verify hook fires on every passwordless sign-in. The cheap
 * pre-check skips the insert in the common (already-verified) path; `onConflictDoNothing`
 * against the `domain_events_user_email_verified_uid` partial unique index closes the
 * concurrency race so at most one event ever exists per user.
 */
export async function publishUserEmailVerified(
  db: Database,
  input: PublishUserEmailVerifiedInput,
): Promise<void> {
  const [existing] = await db
    .select({ id: domainEvent.id })
    .from(domainEvent)
    .where(
      and(
        eq(domainEvent.aggregateType, "user"),
        eq(domainEvent.aggregateId, input.userId),
        eq(domainEvent.eventType, "user.email_verified"),
      ),
    )
    .limit(1);
  if (existing) return;

  const now = new Date();
  await db
    .insert(domainEvent)
    .values({
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
    })
    .onConflictDoNothing();
}
