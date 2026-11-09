import { describe, expect, it } from "vitest";
import {
  PAYMENT_REMINDER_STEPS,
  type PaymentReminderFacts,
  paymentReminderToSend,
  reminderDueAt,
} from "./payment-reminder.js";

const DAY = 86_400_000;
const raisedAt = new Date("2026-11-01T10:00:00Z");
// Raised 1 November with a 7-day term: due at the end of 8 November (London, GMT).
const dueAt = new Date("2026-11-08T23:59:59.999Z");
// The due-day reminder goes out at 09:00 London that day.
const dueDayReminderAt = new Date("2026-11-08T09:00:00Z");

const owed: PaymentReminderFacts = {
  lotStatus: "ended",
  winnerId: "buyer-1",
  buyerId: "buyer-1",
  payment: { status: "pending", raisedAt, dueAt },
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

const at = (offsetMs: number) => new Date(dueDayReminderAt.getTime() + offsetMs);

describe("reminder schedule", () => {
  it("is two days before the due date, on it, and three days after", () => {
    expect(PAYMENT_REMINDER_STEPS).toEqual(["before_due", "due_day", "overdue"]);
    expect(reminderDueAt("before_due", dueAt)).toEqual(at(-2 * DAY));
    expect(reminderDueAt("due_day", dueAt)).toEqual(dueDayReminderAt);
    expect(reminderDueAt("overdue", dueAt)).toEqual(at(3 * DAY));
  });
});

describe("reminder schedule is 09:00 London on every kind of day", () => {
  const nineLondon = (step: Parameters<typeof reminderDueAt>[0], dueIso: string) =>
    reminderDueAt(step, new Date(dueIso)).toISOString();

  it("sends at 09:00 GMT (09:00 UTC) on a normal winter day", () => {
    // Due at the end of Thursday 10 December (GMT).
    const due = "2026-12-10T23:59:59.999Z";
    expect(nineLondon("before_due", due)).toBe("2026-12-08T09:00:00.000Z");
    expect(nineLondon("due_day", due)).toBe("2026-12-10T09:00:00.000Z");
    expect(nineLondon("overdue", due)).toBe("2026-12-13T09:00:00.000Z");
  });

  it("sends at 09:00 BST (08:00 UTC) on a normal summer day", () => {
    // Due at the end of Wednesday 8 July (BST).
    const due = "2026-07-08T22:59:59.999Z";
    expect(nineLondon("before_due", due)).toBe("2026-07-06T08:00:00.000Z");
    expect(nineLondon("due_day", due)).toBe("2026-07-08T08:00:00.000Z");
    expect(nineLondon("overdue", due)).toBe("2026-07-11T08:00:00.000Z");
  });

  it("sends at 09:00 BST on Sunday 29 March 2026, when the clocks go forward", () => {
    // Due at the end of Sunday 29 March (BST, 23:59:59.999 London = 22:59:59.999 UTC).
    expect(nineLondon("due_day", "2026-03-29T22:59:59.999Z")).toBe("2026-03-29T08:00:00.000Z");
    // Two days before a Tuesday due date lands on the change day; three days after a Thursday
    // due date lands on the Sunday too.
    expect(nineLondon("before_due", "2026-03-31T22:59:59.999Z")).toBe("2026-03-29T08:00:00.000Z");
    expect(nineLondon("overdue", "2026-03-26T23:59:59.999Z")).toBe("2026-03-29T08:00:00.000Z");
  });

  it("sends at 09:00 GMT on Sunday 25 October 2026, when the clocks go back", () => {
    // Due at the end of Sunday 25 October (GMT, 23:59:59.999 London = 23:59:59.999 UTC).
    expect(nineLondon("due_day", "2026-10-25T23:59:59.999Z")).toBe("2026-10-25T09:00:00.000Z");
    expect(nineLondon("before_due", "2026-10-27T23:59:59.999Z")).toBe("2026-10-25T09:00:00.000Z");
    expect(nineLondon("overdue", "2026-10-22T22:59:59.999Z")).toBe("2026-10-25T09:00:00.000Z");
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

  it("waits until 09:00 London on a GMT due day", () => {
    const due = "2026-12-10T23:59:59.999Z";
    expect(dueDay(due, "2026-12-10T08:59:59Z", ["before_due"])).toBeNull();
    expect(dueDay(due, "2026-12-10T09:00:00Z", ["before_due"])).toBe("due_day");
  });

  it("waits until 09:00 London on a BST due day (08:00 UTC)", () => {
    const due = "2026-07-10T22:59:59.999Z";
    expect(dueDay(due, "2026-07-10T07:59:59Z", ["before_due"])).toBeNull();
    expect(dueDay(due, "2026-07-10T08:00:00Z", ["before_due"])).toBe("due_day");
  });

  it("waits until 09:00 London on the day the clocks go forward", () => {
    const due = "2026-03-29T22:59:59.999Z";
    expect(dueDay(due, "2026-03-29T07:59:59Z", ["before_due"])).toBeNull();
    expect(dueDay(due, "2026-03-29T08:00:00Z", ["before_due"])).toBe("due_day");
  });

  it("waits until 09:00 London on the day the clocks go back", () => {
    const due = "2026-10-25T23:59:59.999Z";
    expect(dueDay(due, "2026-10-25T08:59:59Z", ["before_due"])).toBeNull();
    expect(dueDay(due, "2026-10-25T09:00:00Z", ["before_due"])).toBe("due_day");
  });

  it("never sends the due-day reminder twice", () => {
    const due = "2026-12-10T23:59:59.999Z";
    expect(dueDay(due, "2026-12-10T10:05:00Z", ["due_day"])).toBeNull();
    expect(dueDay(due, "2026-12-10T23:00:00Z", ["due_day"])).toBeNull();
  });
});
