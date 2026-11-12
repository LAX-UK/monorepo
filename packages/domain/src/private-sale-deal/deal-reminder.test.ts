import { describe, expect, it } from "vitest";
import { dealReminderToSend } from "./deal-reminder.js";

const DAY = 86_400_000;
// Due at the end of 20 November (London, GMT); the due-day reminder is 09:00 that day.
const dueAt = new Date("2026-11-20T23:59:59.999Z");
const dueDay = new Date("2026-11-20T09:00:00Z");

const owed = { kind: "payment", stage: "invoiced", dueAt, sentSteps: [] } as const;

describe("dealReminderToSend", () => {
  it("follows the lot invoice schedule: two days before, the day itself, three days after", () => {
    expect(dealReminderToSend(owed, new Date(dueDay.getTime() - 2 * DAY - 1))).toBeNull();
    expect(dealReminderToSend(owed, new Date(dueDay.getTime() - 2 * DAY))).toBe("before_due");
    expect(dealReminderToSend(owed, dueDay)).toBe("due_day");
    expect(dealReminderToSend(owed, new Date(dueDay.getTime() + 3 * DAY))).toBe("overdue");
  });

  it("sends only the latest step reached, and each step once", () => {
    const late = new Date(dueDay.getTime() + 3 * DAY + 12 * 3_600_000);
    expect(dealReminderToSend(owed, late)).toBe("overdue");
    // Once the overdue day has ended nothing is sent late.
    expect(dealReminderToSend(owed, new Date(dueDay.getTime() + 10 * DAY))).toBeNull();
    expect(dealReminderToSend({ ...owed, sentSteps: ["overdue"] }, late)).toBeNull();
    expect(dealReminderToSend({ ...owed, sentSteps: ["before_due"] }, dueDay)).toBe("due_day");
  });

  it("reminds of the payment only while the deal waits for payment", () => {
    for (const stage of [
      "proposed",
      "offer",
      "agreed",
      "cleared",
      "paid",
      "released",
      "settled",
      "cancelled",
    ] as const) {
      expect(dealReminderToSend({ ...owed, stage }, dueDay)).toBeNull();
    }
  });

  it("reminds of the collection only once the deal is paid and not yet released", () => {
    const collect = { ...owed, kind: "collection" } as const;
    expect(dealReminderToSend({ ...collect, stage: "paid" }, dueDay)).toBe("due_day");
    for (const stage of ["invoiced", "released", "settled", "cancelled"] as const) {
      expect(dealReminderToSend({ ...collect, stage }, dueDay)).toBeNull();
    }
  });

  it("sends nothing when the deal has no deadline", () => {
    expect(dealReminderToSend({ ...owed, dueAt: null }, dueDay)).toBeNull();
  });
});
