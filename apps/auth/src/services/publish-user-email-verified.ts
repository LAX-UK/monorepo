import type { IdentityEventPublisher } from "@auction/auth";

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
  publisher: IdentityEventPublisher,
  input: PublishUserEmailVerifiedInput,
): Promise<void> {
  await publisher.publish(
    { type: "user.email_verified", userId: input.userId, email: input.email },
    { producer: "apps/auth" },
  );
}
