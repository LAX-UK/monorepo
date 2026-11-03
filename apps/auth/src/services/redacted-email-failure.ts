/**
 * Reduces a failure to a name that is safe to log, store and send to Sentry. Database errors
 * quote the statement and its values, which for these emails include the one-time link, so the
 * original message is never kept.
 */
export function redactedEmailFailure(error: unknown): string {
  if (error instanceof Error) {
    return error.message.startsWith("identity_email_enqueue_") ? error.message : error.name;
  }
  return "unknown";
}
