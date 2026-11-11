import {
  type PaymentReminderStep,
  reminderStepReached,
  reminderWindowClosed,
} from "@auction/domain";
import type { IRecipientZoneReader } from "@auction/persistence/interfaces";

/**
 * Stages a payment reminder for each recipient whose own 09:00 has come, and says whether every
 * recipient now has it. A person in another zone is reminded at 09:00 on their clock (never before
 * the London day the step belongs to), so one invoice's recipients are reminded at different
 * moments. The outbox key of each reminder holds the recipient's step, so staging it on every run
 * of the window sends it once; only when everyone has it does the caller take the step.
 * Once the step's window has closed (a late or missed poll) nothing is staged: a reminder is never
 * sent on the wrong London day or after the due time. The step then counts as done, so the caller
 * claims it and it is not looked at again; `windowClosed` tells the caller nothing was sent.
 */
export async function stageForRecipientsDue(input: {
  recipients: readonly string[];
  zones: IRecipientZoneReader;
  dueAt: Date;
  step: PaymentReminderStep;
  now: Date;
  /** Stages the reminder for one person; an already staged one is a no-op in the outbox. */
  stage: (recipientId: string) => Promise<void>;
}): Promise<{ everyoneStaged: boolean; windowClosed: boolean }> {
  if (reminderWindowClosed(input.step, input.dueAt, input.now)) {
    return { everyoneStaged: true, windowClosed: true };
  }
  const saved = await input.zones.zonesFor(input.recipients);
  let everyoneStaged = true;
  for (const recipientId of input.recipients) {
    const reached = reminderStepReached(input.dueAt, input.now, saved.get(recipientId) ?? null);
    if (reached !== input.step) {
      everyoneStaged = false;
      continue;
    }
    await input.stage(recipientId);
  }
  return { everyoneStaged, windowClosed: false };
}
