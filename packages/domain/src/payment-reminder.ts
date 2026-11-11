import {
  LONDON_TIME_ZONE,
  firstExistingWallTime,
  instantToWallClock,
  wallClockToInstant,
} from "@auction/datetime";
import type { LotStatus, PaymentStatus } from "@auction/types";
import { londonDateOf, londonMidnight } from "./calendar-year.js";
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
  return londonMidnight(year, month, day + STEP_OFFSET_DAYS[step]);
}

function shiftDay(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

const previousDay = (day: string): string => shiftDay(day, -1);
const nextDay = (day: string): string => shiftDay(day, 1);

/** 09:00 on a day in `zone`; a day whose 09:00 the clocks skip sends at the first time after it. */
function nineAm(day: string, zone: string): Date {
  const exact = wallClockToInstant(day, PAYMENT_REMINDER_SEND_TIME, zone);
  if (exact.ok) return exact.instant;
  const after = firstExistingWallTime(day, PAYMENT_REMINDER_SEND_TIME, zone);
  const shifted = after ? wallClockToInstant(day, after, zone) : null;
  if (shifted?.ok) return shifted.instant;
  throw new Error(`No 09:00 on ${day} in ${zone}`);
}

/** The last instant a step may be sent: the end of its London day, and never after the due time. */
export function reminderClosesAt(step: PaymentReminderStep, dueAt: Date): Date {
  const { year, month, day } = londonDateOf(dueAt);
  const dayEnd = londonMidnight(year, month, day + STEP_OFFSET_DAYS[step] + 1).getTime() - 1;
  return new Date(step === "due_day" ? Math.min(dayEnd, dueAt.getTime()) : dayEnd);
}

/**
 * When a step is sent to a recipient: exactly once, inside the London day the step belongs to.
 * That is 09:00 on the recipient's clock when it falls inside the day (not before the step opens);
 * for a recipient far from London, whose 09:00 falls outside it, the closest instant inside the
 * day: the moment it opens or the last moment before it ends. With no saved zone that is 09:00
 * London on the day itself.
 */
export function reminderSendAt(
  step: PaymentReminderStep,
  dueAt: Date,
  recipientZone: string | null = null,
): Date {
  const opens = reminderOpensAt(step, dueAt).getTime();
  const closes = reminderClosesAt(step, dueAt).getTime();
  const zone = recipientZone ?? LONDON_TIME_ZONE;
  const day = instantToWallClock(new Date(opens), zone).day;
  // Usually the 09:00 of the day the step opens is inside the day; the others are the fallback.
  const same = nineAm(day, zone).getTime();
  if (same >= opens && same <= closes) return new Date(same);
  const candidates = [
    same,
    ...[nextDay(day), previousDay(day)].map((d) => nineAm(d, zone).getTime()),
  ];
  const inside = candidates.find((at) => at >= opens && at <= closes);
  if (inside !== undefined) return new Date(inside);
  const nearest = candidates.reduce((best, at) =>
    Math.abs(at - clamp(at, opens, closes)) < Math.abs(best - clamp(best, opens, closes))
      ? at
      : best,
  );
  return new Date(clamp(nearest, opens, closes));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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
