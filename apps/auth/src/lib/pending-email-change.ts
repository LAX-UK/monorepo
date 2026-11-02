/** What a person sees of an email change: waiting on an address, expired, or nothing. */
export type PendingEmailChangeState =
  | { kind: "none" }
  | { kind: "waiting"; email: string }
  | { kind: "expired" };

/**
 * A change lives only as long as its emailed links. Once `expiresAt` has passed, the pending row
 * is history: it must not be reported as waiting, only as expired so the person can start again.
 * A row with no expiry predates the window and is treated as still waiting.
 */
export function pendingEmailChangeState(
  row: { pendingNewEmail: string | null; emailChangeExpiresAt: Date | null },
  now: Date,
): PendingEmailChangeState {
  if (!row.pendingNewEmail) return { kind: "none" };
  if (row.emailChangeExpiresAt && row.emailChangeExpiresAt.getTime() <= now.getTime()) {
    return { kind: "expired" };
  }
  return { kind: "waiting", email: row.pendingNewEmail };
}
