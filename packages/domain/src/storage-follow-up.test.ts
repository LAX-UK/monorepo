import { describe, expect, it } from "vitest";
import { createCollectionCalendar } from "./collection-calendar.js";
import {
  type LotStorageFacts,
  STORAGE_FOLLOW_UP_DAYS,
  lotStorageCharge,
  needsStorageFollowUp,
  storageDaysOver,
  storageQuotePauses,
  storageReminderFor,
} from "./storage-follow-up.js";
import {
  type StoragePause,
  type StorageTerms,
  formatStorageRateAfter,
  formatStorageRunningTotal,
} from "./storage-terms.js";

const OPEN_EVERY_DAY = createCollectionCalendar({
  hours: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    opensLocal: "10:00",
    closesLocal: "18:00",
  })),
  exceptions: [],
  rules: { closeOnSaleDays: false },
});

const TERMS: StorageTerms = {
  freeDays: 14,
  countMode: "calendar",
  standardDailyPence: 300,
  largeDailyPence: 600,
  handlingFeePence: 0,
  effectiveFrom: "2026-01-01",
};

// Payment cleared Mon 9 Nov 2026: collect by Mon 23 Nov, charges from Tue 24 Nov.
const CLEARED = new Date("2026-11-09T10:00:00Z");

function lot(
  facts: Partial<LotStorageFacts> = {},
  asOf = "2026-11-24",
  pauses: StoragePause[] = [],
) {
  const full: LotStorageFacts = {
    terms: TERMS,
    large: false,
    extensionDays: 0,
    waived: false,
    ...facts,
  };
  const priced = lotStorageCharge({
    facts: full,
    clearedAt: CLEARED,
    pausedRanges: pauses,
    calendar: OPEN_EVERY_DAY,
    asOf,
  });
  return { ...priced, extensionDays: full.extensionDays };
}

const due = (today: string, facts: Partial<LotStorageFacts> = {}, chargingOn = true) =>
  storageReminderFor(lot(facts, today), today, chargingOn);

describe("lotStorageCharge", () => {
  it("prices a lot under the terms it was sold under, in its band", () => {
    const { charge, band } = lot({ large: true }, "2026-11-30");
    expect(band).toBe("large");
    expect(charge).toMatchObject({
      collectBy: "2026-11-23",
      chargingFrom: "2026-11-24",
      chargeableDays: 7,
      amountPence: 4200,
      state: "charging",
    });
  });

  it("holds a lot won before any terms 30 days free, with nothing charged (ST9)", () => {
    const { charge, terms } = lot({ terms: null }, "2027-01-30");
    expect(terms.freeDays).toBe(30);
    expect(charge).toMatchObject({ collectBy: "2026-12-09", amountPence: 0, state: "overdue" });
  });
});

describe("storageQuotePauses", () => {
  const requestedAt = new Date("2026-11-10T10:00:00Z");

  it("holds the clock from the day a quote was asked until it was quoted", () => {
    expect(
      storageQuotePauses(
        { status: "quoted", requestedAt, quotedAt: new Date("2026-11-12T10:00:00Z") },
        "2026-11-30",
      ),
    ).toEqual([{ from: "2026-11-10", to: "2026-11-12" }]);
  });

  it("holds it until today while LAX still owes the quote, and not for a withdrawn one", () => {
    expect(
      storageQuotePauses({ status: "requested", requestedAt, quotedAt: null }, "2026-11-20"),
    ).toEqual([{ from: "2026-11-10", to: "2026-11-20" }]);
    expect(
      storageQuotePauses({ status: "withdrawn", requestedAt, quotedAt: null }, "2026-11-20"),
    ).toEqual([]);
    expect(storageQuotePauses(null, "2026-11-20")).toEqual([]);
  });
});

describe("storageReminderFor (ST15)", () => {
  it("sends the early reminder from a week before the day until the day before", () => {
    expect(due("2026-11-15")).toBeNull();
    expect(due("2026-11-16")).toEqual({ kind: "lead", collectBy: "2026-11-23", cycle: 0 });
    expect(due("2026-11-22")).toMatchObject({ kind: "lead" });
  });

  it("sends the reminder on the day", () => {
    expect(due("2026-11-23")).toEqual({ kind: "day", collectBy: "2026-11-23", cycle: 0 });
  });

  it("sends 'started' the day after, and keeps it due for 14 days for a missed sweep", () => {
    expect(due("2026-11-24")).toEqual({ kind: "started", collectBy: "2026-11-23", cycle: 0 });
    expect(due("2026-12-07")).toMatchObject({ kind: "started", cycle: 0 });
  });

  it("then sends a running total every 14 days, each run its own cycle", () => {
    expect(due("2026-12-08")).toEqual({ kind: "total", collectBy: "2026-11-23", cycle: 1 });
    expect(due("2026-12-21")).toMatchObject({ kind: "total", cycle: 1 });
    expect(due("2026-12-22")).toMatchObject({ kind: "total", cycle: 2 });
  });

  it("sends no running total while the place raises no storage invoices, but still the day after", () => {
    expect(due("2026-11-24", {}, false)).toMatchObject({ kind: "started" });
    expect(due("2026-12-08", {}, false)).toBeNull();
  });

  it("sends nothing for a waived lot", () => {
    for (const day of ["2026-11-16", "2026-11-23", "2026-11-24", "2026-12-08"]) {
      expect(due(day, { waived: true })).toBeNull();
    }
  });

  it("sends nothing after the day when nothing is owed: no rate, or the legacy terms", () => {
    expect(due("2026-11-24", { terms: { ...TERMS, standardDailyPence: 0 } })).toBeNull();
    // The large band still charges a large work.
    expect(
      due("2026-11-24", { terms: { ...TERMS, standardDailyPence: 0 }, large: true }),
    ).toMatchObject({ kind: "started" });
    expect(due("2026-12-10", { terms: null })).toBeNull();
    expect(due("2026-12-09", { terms: null })).toMatchObject({ kind: "day" });
  });

  it("moves with an extension, so the new day is a new reminder", () => {
    expect(due("2026-11-23", { extensionDays: 7 })).toMatchObject({
      kind: "lead",
      collectBy: "2026-11-30",
    });
    expect(due("2026-11-30", { extensionDays: 7 })).toMatchObject({ kind: "day" });
    expect(due("2026-12-01", { extensionDays: 7 })).toMatchObject({ kind: "started" });
  });

  it("does not count the days LAX held the work for a quote", () => {
    const pauses = [{ from: "2026-11-10", to: "2026-11-12" }];
    const held = lot({}, "2026-11-26", pauses);
    expect(storageReminderFor(held, "2026-11-26", true)).toEqual({
      kind: "day",
      collectBy: "2026-11-26",
      cycle: 0,
    });
  });

  it("has no early reminder for a free period no longer than the lead", () => {
    const short = { terms: { ...TERMS, freeDays: 7 } };
    expect(due("2026-11-15", short)).toBeNull();
    expect(due("2026-11-16", short)).toMatchObject({ kind: "day" });
  });
});

describe("days over and the 60-day follow-up", () => {
  it("counts calendar days past the day, and none before it", () => {
    const { charge } = lot();
    expect(storageDaysOver(charge, "2026-11-20")).toBe(0);
    expect(storageDaysOver(charge, "2026-11-23")).toBe(0);
    expect(storageDaysOver(charge, "2026-12-03")).toBe(10);
  });

  it("flags a lot for follow-up from 60 days over", () => {
    expect(STORAGE_FOLLOW_UP_DAYS).toBe(60);
    expect(needsStorageFollowUp(59)).toBe(false);
    expect(needsStorageFollowUp(60)).toBe(true);
  });
});

describe("the reminder sentences from the one formatter", () => {
  it("states the running total, with the handling fee when there is one", () => {
    const { charge, terms, band } = lot({}, "2026-12-07");
    expect(formatStorageRunningTotal(charge, terms, band)).toBe(
      "£42.00 so far (14 days at £3 a day), plus VAT where it applies.",
    );
    const fee = lot({ terms: { ...TERMS, handlingFeePence: 1500 } }, "2026-11-24");
    expect(formatStorageRunningTotal(fee.charge, fee.terms, fee.band)).toBe(
      "£18.00 so far (1 day at £3 a day, and a £15 handling fee), plus VAT where it applies.",
    );
  });

  it("states the rate after the free period, or nothing when none is charged or it is waived", () => {
    const now = new Date("2026-11-16T10:00:00Z");
    const { charge, terms, band } = lot({}, "2026-11-16");
    expect(formatStorageRateAfter(charge, terms, band, now)).toBe(
      "Free until Mon 23 Nov, then £3 a day, plus VAT where it applies.",
    );
    const large = lot({ large: true }, "2026-11-16");
    expect(formatStorageRateAfter(large.charge, large.terms, large.band, now)).toContain(
      "then £6 a day",
    );
    const legacy = lot({ terms: null }, "2026-11-16");
    expect(formatStorageRateAfter(legacy.charge, legacy.terms, legacy.band, now)).toBeNull();
    const waived = lot({ waived: true }, "2026-11-16");
    expect(formatStorageRateAfter(waived.charge, waived.terms, waived.band, now)).toBeNull();
  });
});
