import { instantToWallClock } from "@auction/datetime";
import { describe, expect, it } from "vitest";
import {
  PAYMENT_REMINDER_STEPS,
  type PaymentReminderStep,
  reminderOpensAt,
  reminderSendAt,
  reminderStepReached,
} from "./payment-reminder.js";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Zones at the extremes of the offset range, with half-hour and 45-minute offsets, and with DST. */
const ZONES = [
  null,
  "Europe/London",
  "Pacific/Kiritimati",
  "Pacific/Pago_Pago",
  "Pacific/Apia",
  "Pacific/Chatham",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Australia/Lord_Howe",
  "Australia/Sydney",
  "America/St_Johns",
  "America/Los_Angeles",
  "America/New_York",
  "Africa/Cairo",
  "Europe/Dublin",
  "Atlantic/Azores",
] as const;

/** Due dates either side of the London, US, Australian and Lord Howe clock changes. */
const EDGE_DUES = [
  "2026-03-07",
  "2026-03-08",
  "2026-03-28",
  "2026-03-29",
  "2026-03-30",
  "2026-04-04",
  "2026-04-05",
  "2026-04-06",
  "2026-10-03",
  "2026-10-04",
  "2026-10-24",
  "2026-10-25",
  "2026-10-26",
  "2026-10-31",
  "2026-11-01",
  "2026-11-02",
].map((day) => new Date(`${day}T23:59:59.999Z`));

/** A repeatable pseudo-random stream, so a failing case can be named and rerun. */
function stream(seed: number) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function randomCases(count: number) {
  const next = stream(7);
  return Array.from({ length: count }, () => ({
    zone: ZONES[Math.floor(next() * ZONES.length)] ?? null,
    dueAt: new Date(Date.UTC(2026, 0, 1) + Math.floor(next() * 360) * DAY + 86_399_999),
  }));
}

/** The clock changes that matter most, polled hour by hour. */
const POLLED_DUES = EDGE_DUES.filter((due) =>
  ["2026-03-29", "2026-04-05", "2026-10-04", "2026-10-25"].includes(due.toISOString().slice(0, 10)),
);

const CASES = [
  ...ZONES.flatMap((zone) => EDGE_DUES.map((dueAt) => ({ zone, dueAt }))),
  ...randomCases(300),
];

describe("payment reminders go out at 09:00 for the recipient, once per London day", () => {
  it.each(CASES.map((c) => [c.zone ?? "no saved zone", c.dueAt.toISOString(), c] as const))(
    "%s, due %s",
    (_zone, _due, { zone, dueAt }) => {
      const sendAts = PAYMENT_REMINDER_STEPS.map((step) => reminderSendAt(step, dueAt, zone));
      PAYMENT_REMINDER_STEPS.forEach((step, index) => {
        const sendAt = sendAts[index] as Date;
        const opens = reminderOpensAt(step, dueAt);
        // Never before the London day the step belongs to has begun.
        expect(sendAt.getTime()).toBeGreaterThanOrEqual(opens.getTime());
        // And within that day's span (a 25-hour day is the longest), so there is one per day.
        expect(sendAt.getTime() - opens.getTime()).toBeLessThanOrEqual(25 * HOUR);
        // 09:00 on the recipient's clock; London when none is saved.
        expect(instantToWallClock(sendAt, zone ?? "Europe/London").time).toMatch(
          /^(09:00|0[9]:\d\d)$/,
        );
        // Exactly one transition into the step: just before it the step has not been reached.
        expect(reminderStepReached(dueAt, new Date(sendAt.getTime() - 1), zone)).not.toBe(step);
        expect(reminderStepReached(dueAt, sendAt, zone)).toBe(step);
      });
      // Steps are days apart, so no two share a London day and none overtakes another.
      for (let i = 1; i < sendAts.length; i += 1) {
        expect(
          (sendAts[i] as Date).getTime() - (sendAts[i - 1] as Date).getTime(),
        ).toBeGreaterThanOrEqual(DAY);
      }
    },
  );

  it("sends each step exactly once when the worker polls every hour", { timeout: 60_000 }, () => {
    const zones = [
      "Pacific/Kiritimati",
      "Pacific/Pago_Pago",
      "Asia/Kolkata",
      "Australia/Lord_Howe",
    ];
    for (const zone of [null, ...zones]) {
      for (const dueAt of POLLED_DUES) {
        const sent = new Map<PaymentReminderStep, Date>();
        const first = reminderOpensAt("before_due", dueAt).getTime() - DAY;
        const last = reminderOpensAt("overdue", dueAt).getTime() + 2 * DAY;
        for (let t = first; t <= last; t += HOUR) {
          const step = reminderStepReached(dueAt, new Date(t), zone);
          if (step && !sent.has(step)) sent.set(step, new Date(t));
        }
        expect([...sent.keys()]).toEqual([...PAYMENT_REMINDER_STEPS]);
        for (const [step, at] of sent) {
          const sendAt = reminderSendAt(step, dueAt, zone);
          // The hourly poll that finds a step is the first one at or after its send time.
          expect(at.getTime() - sendAt.getTime()).toBeLessThan(HOUR);
          expect(at.getTime()).toBeGreaterThanOrEqual(reminderOpensAt(step, dueAt).getTime());
        }
      }
    }
  });

  it("keeps London 09:00 for a recipient with no saved zone, as before", () => {
    const dueAt = new Date("2026-11-08T23:59:59.999Z");
    expect(reminderSendAt("due_day", dueAt, null)).toEqual(new Date("2026-11-08T09:00:00Z"));
    expect(reminderSendAt("due_day", dueAt, "Europe/London")).toEqual(
      new Date("2026-11-08T09:00:00Z"),
    );
  });

  it("sends a recipient in Sydney at 09:00 their time, never before London's day begins", () => {
    const dueAt = new Date("2026-11-08T23:59:59.999Z");
    // 09:00 on 8 November in Sydney is 22:00 on 7 November in London: too early, so the next one.
    expect(reminderSendAt("due_day", dueAt, "Australia/Sydney")).toEqual(
      new Date("2026-11-08T22:00:00Z"),
    );
  });

  it("sends a recipient in Pago Pago at 09:00 their time on the London day itself", () => {
    const dueAt = new Date("2026-11-08T23:59:59.999Z");
    expect(reminderSendAt("due_day", dueAt, "Pacific/Pago_Pago")).toEqual(
      new Date("2026-11-08T20:00:00Z"),
    );
  });
});
