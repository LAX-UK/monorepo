/** What a person sees of an email change: waiting on an address, expired, or nothing. */
export type PendingEmailChangeState =
  | { kind: "none" }
  | { kind: "waiting"; email: string }
  | { kind: "expired" };

/** A pending change is expired once its emailed links have stopped working. No expiry means never. */
export function isPendingEmailExpired(expiresAt: Date | null, now: Date): boolean {
  return expiresAt !== null && expiresAt.getTime() <= now.getTime();
}

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
  if (isPendingEmailExpired(row.emailChangeExpiresAt, now)) {
    return { kind: "expired" };
  }
  return { kind: "waiting", email: row.pendingNewEmail };
}
