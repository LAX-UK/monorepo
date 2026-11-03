/**
 * Templates whose recipient address is copied into the outbox row and must not stay there once
 * the message is sent. The account no longer exists to hold the address, so the copy is the only
 * place it would survive.
 */
export const SNAPSHOT_DISCARDED_AFTER_SEND: ReadonlySet<string> = new Set([
  "account-deletion-completed",
]);
