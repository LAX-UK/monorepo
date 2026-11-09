import { describe, expect, it } from "vitest";
import {
  PAYMENT_REMINDER_SEND_HOUR_LONDON,
  PAYMENT_REMINDER_STEPS,
  type PaymentReminderFacts,
  paymentReminderToSend,
  reminderDueAt,
} from "./payment-reminder.js";

const DAY = 86_400_000;
const raisedAt = new Date("2026-11-01T10:00:00Z");
// Raised 1 November (London); due at the end of 8 November; the due-day reminder is 09:00 that day.
const dueAt = new Date("2026-11-08T09:00:00Z");

const owed: PaymentReminderFacts = {
  lotStatus: "ended",
  winnerId: "buyer-1",
  buyerId: "buyer-1",
  payment: { status: "pending", raisedAt },
  fulfilmentStatus: "awaiting_payment",
  onComplianceHold: false,
  sentSteps: [],
};

describe("reminders follow the stored due date", () => {
  it("waits for a due date that was moved later, and sends nothing while it is ahead", () => {
    const moved: PaymentReminderFacts = {
      ...owed,
      payment: {
        status: "pending",
        raisedAt,
        dueAt: new Date("2026-11-20T23:59:59.999Z"),
      },
    };
    expect(paymentReminderToSend(moved, new Date("2026-11-08T09:00:00Z"))).toBeNull();
    expect(paymentReminderToSend(moved, new Date("2026-11-20T09:00:00Z"))).toBe("due_day");
  });
});

const at = (offsetMs: number) => new Date(dueAt.getTime() + offsetMs);

describe("reminder schedule", () => {
  it("is two days before the due date, on it, and three days after", () => {
    expect(PAYMENT_REMINDER_STEPS).toEqual(["before_due", "due_day", "overdue"]);
    const endOfDueDay = new Date("2026-11-08T23:59:59.999Z");
    expect(reminderDueAt("before_due", endOfDueDay)).toEqual(at(-2 * DAY));
    expect(reminderDueAt("due_day", endOfDueDay)).toEqual(dueAt);
    expect(reminderDueAt("overdue", endOfDueDay)).toEqual(at(3 * DAY));
  });
});

describe("reminder schedule in British Summer Time", () => {
  it("sends at 09:00 London (08:00 UTC) in summer", () => {
    const endOfDueDay = new Date("2026-07-08T22:59:59.999Z");
    expect(reminderDueAt("before_due", endOfDueDay)).toEqual(new Date("2026-07-06T08:00:00Z"));
    expect(reminderDueAt("due_day", endOfDueDay)).toEqual(new Date("2026-07-08T08:00:00Z"));
    expect(reminderDueAt("overdue", endOfDueDay)).toEqual(new Date("2026-07-11T08:00:00Z"));
  });

  it("keeps 09:00 London either side of the October clock change", () => {
    // Due at the end of Monday 26 October 2026 (GMT); the clocks went back on 25 October.
    const endOfDueDay = new Date("2026-10-26T23:59:59.999Z");
    expect(reminderDueAt("before_due", endOfDueDay)).toEqual(new Date("2026-10-24T08:00:00Z"));
    expect(reminderDueAt("due_day", endOfDueDay)).toEqual(new Date("2026-10-26T09:00:00Z"));
  });
});

describe("paymentReminderToSend", () => {
  it("sends nothing before the first step", () => {
    expect(paymentReminderToSend(owed, at(-2 * DAY - 1))).toBeNull();
  });

  it("sends each step once it is reached", () => {
    expect(paymentReminderToSend(owed, at(-2 * DAY))).toBe("before_due");
    expect(paymentReminderToSend(owed, at(0))).toBe("due_day");
    expect(paymentReminderToSend(owed, at(3 * DAY))).toBe("overdue");
  });

  it("is idempotent: a step already sent is not sent again", () => {
    const sent = { ...owed, sentSteps: ["before_due" as const] };
    expect(paymentReminderToSend(sent, at(-DAY))).toBeNull();
    expect(
      paymentReminderToSend({ ...owed, sentSteps: ["before_due", "due_day"] }, at(DAY)),
    ).toBeNull();
    expect(
      paymentReminderToSend({ ...owed, sentSteps: [...PAYMENT_REMINDER_STEPS] }, at(30 * DAY)),
    ).toBeNull();
  });

  it("sends only the latest step after a gap, never a backlog", () => {
    expect(paymentReminderToSend(owed, at(4 * DAY))).toBe("overdue");
  });

  it("keeps reminding a buyer whose checkout was abandoned", () => {
    const abandoned = { ...owed, payment: { status: "cancelled" as const, raisedAt } };
    expect(paymentReminderToSend(abandoned, at(0))).toBe("due_day");
  });

  it("pauses while the payment is held for LAX's own checks", () => {
    const held = { ...owed, payment: { status: "requires_manual_review" as const, raisedAt } };
    expect(paymentReminderToSend(held, at(0))).toBeNull();
    expect(paymentReminderToSend({ ...owed, onComplianceHold: true }, at(0))).toBeNull();
  });

  it("resumes with the current step once a hold lifts", () => {
    expect(paymentReminderToSend({ ...owed, onComplianceHold: false }, at(3 * DAY))).toBe(
      "overdue",
    );
  });

  it("never reminds a buyer who has paid or is paying", () => {
    for (const status of ["authorized", "captured", "refunded"] as const) {
      expect(paymentReminderToSend({ ...owed, payment: { status, raisedAt } }, at(0))).toBeNull();
    }
  });

  it("never reminds for a purchase that has ended", () => {
    expect(paymentReminderToSend({ ...owed, fulfilmentStatus: "cancelled" }, at(0))).toBeNull();
  });

  it("needs an invoice, an ended lot and the winner as the payer", () => {
    expect(paymentReminderToSend({ ...owed, payment: null }, at(0))).toBeNull();
    expect(paymentReminderToSend({ ...owed, lotStatus: "draft" }, at(0))).toBeNull();
    expect(paymentReminderToSend({ ...owed, winnerId: "someone-else" }, at(0))).toBeNull();
  });
});

describe("due-day reminder at the fixed morning hour", () => {
  const dueDay = (
    dueAtIso: string,
    nowIso: string,
    sentSteps: PaymentReminderFacts["sentSteps"] = [],
  ) =>
    paymentReminderToSend(
      { ...owed, payment: { status: "pending", raisedAt, dueAt: new Date(dueAtIso) }, sentSteps },
      new Date(nowIso),
    );

  it("names the hour as 09:00", () => {
    expect(PAYMENT_REMINDER_SEND_HOUR_LONDON).toBe(9);
  });

  it("waits until 09:00 London on a GMT day, whatever time the due date falls", () => {
    const due = "2026-12-10T10:00:00Z";
    expect(reminderDueAt("due_day", new Date(due))).toEqual(new Date("2026-12-10T09:00:00Z"));
    expect(dueDay(due, "2026-12-10T08:59:59Z", ["before_due"])).toBeNull();
    expect(dueDay(due, "2026-12-10T09:00:00Z", ["before_due"])).toBe("due_day");
  });

  it("waits until 09:00 London on a BST day (08:00 UTC)", () => {
    const due = "2026-07-10T15:00:00Z";
    expect(reminderDueAt("due_day", new Date(due))).toEqual(new Date("2026-07-10T08:00:00Z"));
    expect(dueDay(due, "2026-07-10T07:59:59Z", ["before_due"])).toBeNull();
    expect(dueDay(due, "2026-07-10T08:00:00Z", ["before_due"])).toBe("due_day");
  });

  it("sends at once when 09:00 has already passed (sale ends 10:00, due the same day)", () => {
    const due = "2026-12-10T10:00:00Z";
    expect(dueDay(due, "2026-12-10T10:00:01Z")).toBe("due_day");
  });

  it("never sends the due-day reminder twice", () => {
    const due = "2026-12-10T10:00:00Z";
    expect(dueDay(due, "2026-12-10T10:05:00Z", ["due_day"])).toBeNull();
    expect(dueDay(due, "2026-12-10T23:00:00Z", ["due_day"])).toBeNull();
  });
});
