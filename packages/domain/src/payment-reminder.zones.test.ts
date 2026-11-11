import { instantToWallClock, wallClockToInstant } from "@auction/datetime";
import { describe, expect, it } from "vitest";
import { londonDateOf } from "./calendar-year.js";
import {
  PAYMENT_REMINDER_POLL_INTERVAL_MS,
  PAYMENT_REMINDER_STEPS,
  type PaymentReminderStep,
  reminderClosesAt,
  reminderOpensAt,
  reminderSendAt,
  reminderStepReached,
  reminderWindowClosed,
} from "./payment-reminder.js";

const HOUR = 3_600_000;
/** The worker runs the reminders job this often. */
const POLL = PAYMENT_REMINDER_POLL_INTERVAL_MS;
const DAY = 24 * HOUR;

const londonDayOf = (at: Date) => {
  const { year, month, day } = londonDateOf(at);
  return `${year}-${month}-${day}`;
};

/** The end of a London calendar day: the due time an invoice carries. */
const dueOf = (year: number, month: number, day: number) => {
  const next = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  const midnight = wallClockToInstant(next, "00:00", "Europe/London");
  if (!midnight.ok) throw new Error(`No London midnight on ${next}`);
  return new Date(midnight.instant.getTime() - 1);
};

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
]
  .map((day) => new Date(`${day}T00:00:00Z`))
  .map((at) => dueOf(at.getUTCFullYear(), at.getUTCMonth() + 1, at.getUTCDate()));

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
    dueAt: dueOf(2026, 1, 1 + Math.floor(next() * 360)),
  }));
}

/** The clock changes that matter most, polled every run. */
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
        // 09:00 on the recipient's clock; London when none is saved.
        if (sendAt.getTime() !== opens.getTime()) {
          expect(instantToWallClock(sendAt, zone ?? "Europe/London").time).toBe("09:00");
        }
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

  it(
    "sends each step exactly once when the worker polls every 15 minutes",
    { timeout: 60_000 },
    () => {
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
          for (let t = first; t <= last; t += POLL) {
            const step = reminderStepReached(dueAt, new Date(t), zone);
            if (step && !sent.has(step)) sent.set(step, new Date(t));
          }
          expect([...sent.keys()]).toEqual([...PAYMENT_REMINDER_STEPS]);
          for (const [step, at] of sent) {
            const sendAt = reminderSendAt(step, dueAt, zone);
            // The poll that finds a step is the first one at or after its send time.
            expect(at.getTime() - sendAt.getTime()).toBeLessThan(POLL);
            expect(at.getTime()).toBeGreaterThanOrEqual(reminderOpensAt(step, dueAt).getTime());
            // The run that sends it is in the step's own London day, and not after due on the due day.
            expect(londonDayOf(at)).toBe(londonDayOf(reminderOpensAt(step, dueAt)));
            if (step === "due_day") expect(at.getTime()).toBeLessThanOrEqual(dueAt.getTime());
          }
        }
      }
    },
  );

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

describe("a window that has closed is never sent late", () => {
  it("reports a step closed only after the last instant of its London day", () => {
    const dueAt = dueOf(2026, 3, 29);
    for (const step of PAYMENT_REMINDER_STEPS) {
      const closes = reminderClosesAt(step, dueAt);
      expect(reminderWindowClosed(step, dueAt, closes)).toBe(false);
      expect(reminderWindowClosed(step, dueAt, new Date(closes.getTime() + 1))).toBe(true);
    }
  });

  it("sends no later than two poll intervals before the window closes", () => {
    for (const zone of [null, "Australia/Adelaide", "Australia/Brisbane", "Pacific/Auckland"]) {
      for (const step of PAYMENT_REMINDER_STEPS) {
        const dueAt = dueOf(2026, 3, 29);
        const sendAt = reminderSendAt(step, dueAt, zone).getTime();
        const opens = reminderOpensAt(step, dueAt).getTime();
        if (sendAt > opens) {
          expect(sendAt).toBeLessThanOrEqual(reminderClosesAt(step, dueAt).getTime() - 2 * POLL);
        }
      }
    }
  });

  it("does not send the London reminder after its window, even when the step is unsent", () => {
    const dueAt = dueOf(2026, 3, 29);
    const late = new Date(reminderClosesAt("due_day", dueAt).getTime() + 1);
    expect(reminderWindowClosed("due_day", dueAt, late)).toBe(true);
  });
});

describe("every zone, every day of 2026 and 2027: one reminder per London day, inside it", () => {
  const ALL_ZONES = [
    ...new Set([
      ...Intl.supportedValuesOf("timeZone"),
      "Pacific/Kiritimati",
      "Pacific/Pago_Pago",
      "Asia/Kolkata",
      "Australia/Lord_Howe",
      "Australia/Sydney",
    ]),
  ];
  const londonDay = londonDayOf;
  /** Zones in slices, so each test stays short and the suite never blocks for long at a time. */
  const SLICE = 40;
  const slices = Array.from({ length: Math.ceil(ALL_ZONES.length / SLICE) + 1 }, (_, n) =>
    n === 0 ? [null] : ALL_ZONES.slice((n - 1) * SLICE, n * SLICE),
  );

  it.each(slices.map((zones, n) => [`slice ${n + 1} of ${slices.length}`, zones] as const))(
    "holds for every day's due date in every zone: %s",
    { timeout: 120_000 },
    (_name, zones) => {
      const failures: string[] = [];
      const first = Date.UTC(2026, 0, 1);
      const days = 730;
      for (const zone of zones) {
        for (let i = 0; i < days; i += 1) {
          const at = new Date(first + i * DAY);
          const dueAt = dueOf(at.getUTCFullYear(), at.getUTCMonth() + 1, at.getUTCDate());
          const seen = new Set<string>();
          for (const step of PAYMENT_REMINDER_STEPS) {
            const sendAt = reminderSendAt(step, dueAt, zone);
            const opens = reminderOpensAt(step, dueAt);
            const label = `${zone ?? "none"} ${dueAt.toISOString()} ${step} -> ${sendAt.toISOString()}`;
            // A poll is missed, then the next one runs a whole interval (less 1 ms) late: the
            // latest run that can still send the step. It must still be in the step's London day.
            const lastRun = new Date(sendAt.getTime() + 2 * POLL - 1);
            if (londonDay(sendAt) !== londonDay(opens)) failures.push(`${label}: wrong London day`);
            if (londonDay(lastRun) !== londonDay(opens)) {
              failures.push(`${label}: sent by a run in the next London day`);
            }
            if (step === "due_day" && lastRun.getTime() > dueAt.getTime()) {
              failures.push(`${label}: sent by a run after the due time`);
            }
            if (sendAt.getTime() < opens.getTime()) failures.push(`${label}: before it opens`);
            if (step === "due_day" && sendAt.getTime() > dueAt.getTime()) {
              failures.push(`${label}: after the due time`);
            }
            seen.add(londonDay(lastRun));
          }
          if (seen.size !== PAYMENT_REMINDER_STEPS.length)
            failures.push(`${zone} ${dueAt.toISOString()}: shared a London day`);
        }
      }
      expect(failures.slice(0, 20)).toEqual([]);
    },
  );

  it("sends UTC+10 zones on London's 23-hour spring-forward day inside that day", () => {
    const dueAt = dueOf(2026, 3, 29);
    for (const zone of ["Australia/Brisbane", "Asia/Vladivostok", "Pacific/Guam"]) {
      for (const step of PAYMENT_REMINDER_STEPS) {
        const sendAt = reminderSendAt(step, dueAt, zone);
        const lastRun = new Date(sendAt.getTime() + 2 * POLL - 1);
        expect(londonDayOf(lastRun)).toBe(londonDayOf(reminderOpensAt(step, dueAt)));
      }
      expect(reminderSendAt("due_day", dueAt, zone)).toEqual(reminderOpensAt("due_day", dueAt));
    }
  });
});
