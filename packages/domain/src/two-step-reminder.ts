/**
 * Reminding members to turn on two-step verification. An owner or admin sends one email to every
 * member who doesn't have it on (never to themselves). It changes nothing by itself, so it is
 * only limited against nagging: one send per organisation, and one email per member, a day.
 */

/** How long after a reminder the organisation can send another, and a member gets another. */
export const TWO_STEP_REMINDER_COOLDOWN_SECONDS = 24 * 60 * 60;

export type TwoStepMember = { userId: string; twoFactorEnabled: boolean | null };

/**
 * Who a reminder goes to: members without two-step on, the sender left out. A status that could
 * not be read counts as off, since being reminded of something already on is harmless.
 */
export function twoStepReminderRecipients(
  members: readonly TwoStepMember[],
  senderUserId: string,
): string[] {
  const ids = members
    .filter((m) => m.twoFactorEnabled !== true && m.userId !== senderUserId)
    .map((m) => m.userId);
  return [...new Set(ids)];
}

export type TwoStepReminderRefusal = "nobody_to_remind" | "sent_recently";

export const TWO_STEP_REMINDER_REFUSAL_MESSAGE: Record<TwoStepReminderRefusal, string> = {
  nobody_to_remind: "Everyone else already has two-step on, so there's nobody to remind.",
  sent_recently: "A reminder was sent in the last day. You can send another tomorrow.",
};
