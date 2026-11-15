import { describe, expect, it } from "vitest";
import {
  type CollectByPolicy,
  DEFAULT_COLLECT_BY_POLICY,
  awaitsCollection,
  collectBy,
  collectByClearedRange,
  collectByReminderFor,
  purchaseCollectBy,
} from "./collection-storage.js";

describe("the please-collect-by day", () => {
  it("is the London day payment cleared plus the free period, with its two reminder days", () => {
    // 23:30 UTC on 9 Nov is 23:30 GMT: the same London day.
    expect(collectBy(new Date("2026-11-09T23:30:00Z"))).toEqual({
      date: "2026-12-09",
      reminderDates: ["2026-12-02", "2026-12-09"],
    });
  });

  it("counts the London day in summer, not the UTC day", () => {
    // 23:30 UTC on 9 Jun is 00:30 BST on 10 Jun.
    expect(collectBy(new Date("2026-06-09T23:30:00Z")).date).toBe("2026-07-10");
  });
});

describe("the storage reminder a purchase is due", () => {
  // Cleared Mon 9 Nov: the deadline is Wed 9 Dec, the early reminder from Wed 2 Dec.
  const cleared = new Date("2026-11-09T10:00:00Z");

  it("is the early reminder from a week before the deadline, on every day until it", () => {
    for (const day of ["2026-12-02", "2026-12-05", "2026-12-08"]) {
      expect(collectByReminderFor(cleared, day)).toEqual({ kind: "lead", collectBy: "2026-12-09" });
    }
    expect(collectByReminderFor(cleared, "2026-12-01")).toBeNull();
  });

  it("is the reminder on the day only on the deadline, and none after", () => {
    expect(collectByReminderFor(cleared, "2026-12-09")).toEqual({
      kind: "day",
      collectBy: "2026-12-09",
    });
    expect(collectByReminderFor(cleared, "2026-12-10")).toBeNull();
  });

  it("counts the London day payment cleared, not the UTC day", () => {
    // 23:30 UTC on 9 Jun is 00:30 BST on 10 Jun: the deadline is 10 Jul.
    const summer = new Date("2026-06-09T23:30:00Z");
    expect(collectByReminderFor(summer, "2026-07-10")).toEqual({
      kind: "day",
      collectBy: "2026-07-10",
    });
  });

  it("agrees with the please-collect-by day a purchase was given when it cleared", () => {
    const { date, reminderDates } = collectBy(cleared);
    expect(collectByReminderFor(cleared, reminderDates[0])).toMatchObject({
      kind: "lead",
      collectBy: date,
    });
    expect(collectByReminderFor(cleared, reminderDates[1])).toMatchObject({
      kind: "day",
      collectBy: date,
    });
  });

  it("follows a place's own free period", () => {
    const policy: CollectByPolicy = { ...DEFAULT_COLLECT_BY_POLICY, freeStorageDays: 14 };
    expect(collectByReminderFor(cleared, "2026-11-16", policy)).toMatchObject({
      kind: "lead",
      collectBy: "2026-11-23",
    });
  });

  it("has no early reminder when the free period is no longer than the lead", () => {
    const short: CollectByPolicy = { freeStorageDays: 7, reminderLeadDays: 7 };
    expect(collectByReminderFor(cleared, "2026-11-10", short)).toBeNull();
    expect(collectByReminderFor(cleared, "2026-11-16", short)).toMatchObject({ kind: "day" });
  });
});

describe("the clearance days a reminder today can be for", () => {
  it("runs from the free period ago to the free period less the lead ago", () => {
    expect(collectByClearedRange("2026-12-05")).toEqual({ from: "2026-11-05", to: "2026-11-12" });
  });

  it("is the single day the free period ago when there is no early reminder", () => {
    expect(
      collectByClearedRange("2026-11-30", { freeStorageDays: 7, reminderLeadDays: 7 }),
    ).toEqual({
      from: "2026-11-23",
      to: "2026-11-23",
    });
  });

  it("holds every purchase that is due a reminder", () => {
    const today = "2026-12-05";
    const { from, to } = collectByClearedRange(today);
    for (const clearedOn of ["2026-11-04", "2026-11-05", "2026-11-12", "2026-11-13"]) {
      const due = collectByReminderFor(new Date(`${clearedOn}T12:00:00Z`), today) !== null;
      expect(due, clearedOn).toBe(clearedOn >= from && clearedOn <= to);
    }
  });
});

describe("the collect-by notice's state", () => {
  // Cleared Mon 9 Nov: the deadline is Wed 9 Dec, the lead starts Wed 2 Dec.
  const cleared = new Date("2026-11-09T10:00:00Z");

  it("is upcoming until the lead, soon through the day itself, overdue after", () => {
    expect(purchaseCollectBy(cleared, "2026-12-01")).toEqual({
      date: "2026-12-09",
      state: "upcoming",
    });
    expect(purchaseCollectBy(cleared, "2026-12-02").state).toBe("soon");
    expect(purchaseCollectBy(cleared, "2026-12-09").state).toBe("soon");
    expect(purchaseCollectBy(cleared, "2026-12-10").state).toBe("overdue");
  });

  it("is soon only on the day itself when the free period is no longer than the lead", () => {
    const policy: CollectByPolicy = { freeStorageDays: 7, reminderLeadDays: 7 };
    expect(purchaseCollectBy(cleared, "2026-11-10", policy).state).toBe("upcoming");
    expect(purchaseCollectBy(cleared, "2026-11-16", policy).state).toBe("soon");
  });
});

describe("whether a paid purchase still waits to be collected", () => {
  const waiting = {
    fulfilment: { status: "released", method: "collection" },
    saleDeleted: false,
    bookingOpen: true,
    booked: false,
  } as const;

  it("waits while released or ready, by collection or with no method chosen yet", () => {
    for (const status of ["awaiting_release", "released", "ready_for_collection"] as const) {
      for (const method of ["collection", null] as const) {
        expect(awaitsCollection({ ...waiting, fulfilment: { status, method } })).toBe(true);
      }
    }
  });

  it("does not wait once handed over, cancelled, on its way, or before it is paid", () => {
    for (const status of ["delivered", "cancelled", "in_transit", "awaiting_payment"] as const) {
      expect(awaitsCollection({ ...waiting, fulfilment: { status, method: null } })).toBe(false);
    }
  });

  it("does not wait when it goes by courier, even while ready for collection", () => {
    const fulfilment = { status: "ready_for_collection", method: "shipping" } as const;
    expect(awaitsCollection({ ...waiting, fulfilment })).toBe(false);
  });

  it("does not wait in a deleted sale, at a place with no online booking, once booked, or with no record", () => {
    expect(awaitsCollection({ ...waiting, saleDeleted: true })).toBe(false);
    expect(awaitsCollection({ ...waiting, bookingOpen: false })).toBe(false);
    expect(awaitsCollection({ ...waiting, booked: true })).toBe(false);
    expect(awaitsCollection({ ...waiting, fulfilment: null })).toBe(false);
  });
});
