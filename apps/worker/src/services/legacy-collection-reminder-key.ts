/**
 * Transition guard for the day-before collection reminders.
 *
 * Until 2026-11-10 a reminder's outbox key ended with the recipient's email address. Keys now end
 * with the account id (or a hash of the address), so a reminder already queued under the old key
 * would look new to the outbox and be sent a second time while the sweep re-runs that day.
 * The sweep therefore also asks for the old key and skips a reminder that exists under it.
 *
 * Remove this file, its use in `collection-reminders.ts` and `existingOutboxKeys` from the reader
 * after 2026-11-14: reminders go out the day before a visit, so by then no visit can still be
 * reminded under the old format.
 */
export function legacyCollectionReminderKey(
  bookingId: string,
  slotStart: Date,
  email: string,
): string {
  return `collection-reminder:${bookingId}:${slotStart.toISOString()}:${email.toLowerCase()}`;
}
