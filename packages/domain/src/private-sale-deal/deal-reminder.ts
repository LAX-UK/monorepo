import type { PrivateSaleDealStage } from "@auction/types";
import {
  type PaymentReminderStep,
  reminderStepOpen,
  reminderStepReached,
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
 * The reminder to send for one deadline now at 09:00 London, or `null`. It follows the same
 * schedule as a lot invoice (two days before, the day itself, three days after) so buyers get one
 * rhythm. Only the latest step reached is sent, so a worker that was down does not send a backlog,
 * and each step goes once. A collection is a visit to a place, so it always runs on London time.
 */
export function dealReminderToSend(
  facts: DealReminderFacts,
  now: Date,
): PaymentReminderStep | null {
  const open = dealReminderOpen(facts, now);
  if (!open) return null;
  const reached = reminderStepReached(open.dueAt, now, null);
  return reached && !facts.sentSteps.includes(reached) ? reached : null;
}

/**
 * The step of a deadline whose London day has begun and that is not yet fully sent, with the
 * deadline: what a payment reminder then sends each recipient at 09:00 in their own zone.
 */
export function dealReminderOpen(
  facts: DealReminderFacts,
  now: Date,
): { step: PaymentReminderStep; dueAt: Date } | null {
  if (facts.dueAt === null || facts.stage !== OPEN_IN_STAGE[facts.kind]) return null;
  const step = reminderStepOpen(facts.dueAt, now);
  return step && !facts.sentSteps.includes(step) ? { step, dueAt: facts.dueAt } : null;
}
