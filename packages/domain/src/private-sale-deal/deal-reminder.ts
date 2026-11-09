import type { PrivateSaleDealStage } from "@auction/types";
import {
  PAYMENT_REMINDER_STEPS,
  type PaymentReminderStep,
  reminderDueAt,
} from "../payment-reminder.js";

/** The two deadlines a deal sets: when the buyer pays, and when the work is collected. */
export const DEAL_DEADLINE_KINDS = ["payment", "collection"] as const;
export type DealDeadlineKind = (typeof DEAL_DEADLINE_KINDS)[number];

/** A deadline is reminded only while its step is still open: unpaid for payment, uncollected for collection. */
const OPEN_IN_STAGE: Readonly<Record<DealDeadlineKind, PrivateSaleDealStage>> = {
  payment: "invoiced",
  collection: "paid",
};

export type DealReminderFacts = {
  kind: DealDeadlineKind;
  stage: PrivateSaleDealStage;
  /** The deadline as stored on the deal; none means nothing to remind. */
  dueAt: Date | null;
  sentSteps: readonly PaymentReminderStep[];
};

/**
 * The reminder to send for one deadline now, or `null`. It follows the same schedule as a lot
 * invoice (two days before, the day itself, three days after) so buyers get one rhythm. Only the
 * latest step reached is sent, so a worker that was down does not send a backlog, and each step
 * goes once.
 */
export function dealReminderToSend(
  facts: DealReminderFacts,
  now: Date,
): PaymentReminderStep | null {
  if (facts.dueAt === null || facts.stage !== OPEN_IN_STAGE[facts.kind]) return null;
  let latest: PaymentReminderStep | null = null;
  for (const step of PAYMENT_REMINDER_STEPS) {
    if (reminderDueAt(step, facts.dueAt).getTime() <= now.getTime()) latest = step;
  }
  if (!latest || facts.sentSteps.includes(latest)) return null;
  return latest;
}
