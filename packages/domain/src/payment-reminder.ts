import {
  LONDON_TIME_ZONE,
  firstExistingWallTime,
  instantToWallClock,
  wallClockToInstant,
} from "@auction/datetime";
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

/** Reminders go out at 09:00 on their day, in the recipient's zone (London when none is saved). */
const PAYMENT_REMINDER_SEND_TIME = "09:00";

/** The first instant of the London day a step belongs to: no recipient is reminded before it. */
export function reminderOpensAt(step: PaymentReminderStep, dueAt: Date): Date {
  const { year, month, day } = londonDateOf(dueAt);
  return londonWallClock(year, month, day + STEP_OFFSET_DAYS[step], 0);
}

function nextDay(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

/** 09:00 on a day in `zone`; a day whose 09:00 the clocks skip sends at the first time after it. */
function nineAm(day: string, zone: string): Date {
  const exact = wallClockToInstant(day, PAYMENT_REMINDER_SEND_TIME, zone);
  if (exact.ok) return exact.instant;
  const after = firstExistingWallTime(day, PAYMENT_REMINDER_SEND_TIME, zone);
  const shifted = after ? wallClockToInstant(day, after, zone) : null;
  if (shifted?.ok) return shifted.instant;
  throw new Error(`No 09:00 on ${day} in ${zone}`);
}

/**
 * When a step is sent to a recipient: the first 09:00 on their clock that is not before the London
 * day the step belongs to. With no saved zone that is 09:00 London on the day itself. A recipient
 * far ahead of London may get it the next morning on their clock (their 09:00 on the day itself
 * falls before London's day began); nobody gets one before it.
 */
export function reminderSendAt(
  step: PaymentReminderStep,
  dueAt: Date,
  recipientZone: string | null = null,
): Date {
  const opens = reminderOpensAt(step, dueAt);
  const zone = recipientZone ?? LONDON_TIME_ZONE;
  const day = instantToWallClock(opens, zone).day;
  const first = nineAm(day, zone);
  return first.getTime() >= opens.getTime() ? first : nineAm(nextDay(day), zone);
}

/** When a step is sent with no recipient zone: 09:00 London on the due day, or days before or after. */
export function reminderDueAt(step: PaymentReminderStep, dueAt: Date): Date {
  return reminderSendAt(step, dueAt, null);
}

function latestStep(
  now: Date,
  startOf: (step: PaymentReminderStep) => Date,
): PaymentReminderStep | null {
  let latest: PaymentReminderStep | null = null;
  for (const step of PAYMENT_REMINDER_STEPS) {
    if (startOf(step).getTime() <= now.getTime()) latest = step;
  }
  return latest;
}

/** The latest step whose send time has come for a recipient in `zone`, or `null` before the first. */
export function reminderStepReached(
  dueAt: Date,
  now: Date,
  recipientZone: string | null,
): PaymentReminderStep | null {
  return latestStep(now, (step) => reminderSendAt(step, dueAt, recipientZone));
}

/** The latest step whose London day has begun: the earliest any recipient can be sent one. */
export function reminderStepOpen(dueAt: Date, now: Date): PaymentReminderStep | null {
  return latestStep(now, (step) => reminderOpensAt(step, dueAt));
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
 * The step to send now at 09:00 London, or `null`: the schedule for a payer with no saved zone.
 * See `paymentReminderOpen` for the step a payer in another zone may be sent.
 */
export function paymentReminderToSend(
  facts: PaymentReminderFacts,
  now: Date,
): PaymentReminderStep | null {
  const dueAt = remindableDueAt(facts);
  if (!dueAt) return null;
  const latest = reminderStepReached(dueAt, now, null);
  return latest && !facts.sentSteps.includes(latest) ? latest : null;
}

/**
 * The step whose London day has begun and that is not yet fully sent, with the due date, or
 * `null`. Only the latest step reached is ever sent (a worker that was down does not send a
 * backlog), each step goes once, and nothing is sent while the payment is held for LAX's own
 * checks, once the buyer is paying or has paid, or after the sale has ended. Each recipient is
 * then sent it from `reminderStepReached` for their own zone.
 */
export function paymentReminderOpen(
  facts: PaymentReminderFacts,
  now: Date,
): { step: PaymentReminderStep; dueAt: Date } | null {
  const dueAt = remindableDueAt(facts);
  if (!dueAt) return null;
  const step = reminderStepOpen(dueAt, now);
  return step && !facts.sentSteps.includes(step) ? { step, dueAt } : null;
}

/** The due date the schedule runs from, or `null` when no reminder makes sense. */
function remindableDueAt(facts: PaymentReminderFacts): Date | null {
  const { payment } = facts;
  if (!payment || facts.lotStatus !== "ended" || facts.winnerId !== facts.buyerId) return null;
  if (!REMINDABLE.includes(payment.status)) return null;
  if (facts.onComplianceHold) return null;
  if (purchaseEnding({ paymentStatus: payment.status, fulfilmentStatus: facts.fulfilmentStatus })) {
    return null;
  }
  return storedDueAt(payment);
}
