import type { LotStatus, PaymentStatus } from "@auction/types";
import { londonDateOf, londonWallClock } from "./calendar-year.js";
import { storedDueAt } from "./purchase-invoice-state.js";
import { purchaseEnding } from "./purchase-state.js";

/** The reminders a buyer gets for an unpaid invoice, in the order they are sent. */
export const PAYMENT_REMINDER_STEPS = ["before_due", "due_day", "overdue"] as const;
export type PaymentReminderStep = (typeof PAYMENT_REMINDER_STEPS)[number];

/** When each step falls, as days from the due date: two before, the day itself, three after. */
const STEP_OFFSET_DAYS: Record<PaymentReminderStep, number> = {
  before_due: -2,
  due_day: 0,
  overdue: 3,
};

/** Reminders go out at 09:00 London on their day, not at the end-of-day due moment. */
const PAYMENT_REMINDER_SEND_HOUR_LONDON = 9;

/** When a step is sent: 09:00 London on the due day, or that many London days before or after. */
export function reminderDueAt(step: PaymentReminderStep, dueAt: Date): Date {
  const { year, month, day } = londonDateOf(dueAt);
  return londonWallClock(
    year,
    month,
    day + STEP_OFFSET_DAYS[step],
    PAYMENT_REMINDER_SEND_HOUR_LONDON,
  );
}

export type PaymentReminderFacts = {
  lotStatus: LotStatus;
  winnerId: string | null;
  /** The account holder the invoice is raised to. */
  buyerId: string;
  /** The lot's latest invoice, or `null` while none is raised. */
  payment: { status: PaymentStatus; raisedAt: Date; dueAt: Date | null } | null;
  fulfilmentStatus: string | null;
  /** The buyer is on an AML or source-of-funds hold, so LAX itself is what stops payment. */
  onComplianceHold: boolean;
  sentSteps: readonly PaymentReminderStep[];
};

/** Payment states in which the buyer still has to pay, so reminding them makes sense. */
const REMINDABLE: readonly PaymentStatus[] = ["pending", "cancelled"];

/**
 * The reminder to send now, or `null`. Only the latest step reached is ever sent (a worker that
 * was down does not send a backlog), each step goes once, and nothing is sent while the payment is
 * held for LAX's own checks, once the buyer is paying or has paid, or after the sale has ended.
 */
export function paymentReminderToSend(
  facts: PaymentReminderFacts,
  now: Date,
): PaymentReminderStep | null {
  const { payment } = facts;
  if (!payment || facts.lotStatus !== "ended" || facts.winnerId !== facts.buyerId) return null;
  if (!REMINDABLE.includes(payment.status)) return null;
  if (facts.onComplianceHold) return null;
  if (purchaseEnding({ paymentStatus: payment.status, fulfilmentStatus: facts.fulfilmentStatus })) {
    return null;
  }

  const dueAt = storedDueAt(payment);
  let latest: PaymentReminderStep | null = null;
  for (const step of PAYMENT_REMINDER_STEPS) {
    if (reminderDueAt(step, dueAt).getTime() <= now.getTime()) latest = step;
  }
  if (!latest || facts.sentSteps.includes(latest)) return null;
  return latest;
}
