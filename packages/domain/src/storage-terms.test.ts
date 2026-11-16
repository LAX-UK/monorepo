import { describe, expect, it } from "vitest";
import { bankHolidayClosures, createCollectionCalendar } from "./collection-calendar.js";
import type { CollectionException, CollectionWeeklyHours } from "./collection-calendar.js";
import { DEFAULT_COLLECTION_RULES } from "./collection-rules.js";
import {
  type StorageCharge,
  type StorageChargeInput,
  type StorageTerms,
  calculateStorageCharge,
  formatStorageBadge,
  formatStorageDeskLine,
  formatStorageInvoiceLine,
  formatStorageNotice,
  formatStorageTerms,
  storageClearedOn,
} from "./storage-terms.js";

/** Monday to Friday, 10:00 to 19:00. */
const HOURS: CollectionWeeklyHours[] = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  opensLocal: "10:00",
  closesLocal: "19:00",
}));

const closure = (startsOn: string, endsOn = startsOn): CollectionException => ({
  kind: "closure",
  startsOn,
  endsOn,
  opensLocal: null,
  closesLocal: null,
  source: "staff",
});

const calendarOf = (exceptions: CollectionException[] = []) =>
  createCollectionCalendar({ hours: HOURS, exceptions, rules: DEFAULT_COLLECTION_RULES });

const TERMS: StorageTerms = {
  freeDays: 14,
  dayCount: "calendar",
  standardDailyPence: 300,
  largeDailyPence: 600,
  handlingFeePence: 0,
  effectiveFrom: "2026-11-16",
};

const base = (over: Partial<StorageChargeInput> = {}): StorageChargeInput => ({
  terms: TERMS,
  clearedOn: "2026-11-02", // Monday
  extensionDays: 0,
  waived: false,
  pausedRanges: [],
  band: "standard",
  asOf: "2026-11-02",
  calendar: calendarOf(),
  ...over,
});

const charge = (over: Partial<StorageChargeInput> = {}): StorageCharge =>
  calculateStorageCharge(base(over));

describe("the collect-by day", () => {
  it("is the cleared day plus the free days, counted in calendar days", () => {
    expect(charge().collectBy).toBe("2026-11-16");
  });

  it("moves to the next open day when it lands on a weekend", () => {
    // Cleared Tue 3 Nov + 14 = Tue 17 Nov (open); Sat 7 Nov + 14 = Sat 21 Nov.
    expect(charge({ clearedOn: "2026-11-07" }).collectBy).toBe("2026-11-23");
  });

  it("moves past a closure and a bank holiday", () => {
    const calendar = calendarOf([...bankHolidayClosures([2026]), closure("2026-12-24")]);
    // Cleared Thu 10 Dec + 14 = Thu 24 Dec (closed), Fri 25 (bank holiday), weekend, Mon 28 (bh).
    expect(charge({ clearedOn: "2026-12-10", calendar }).collectBy).toBe("2026-12-29");
  });

  it("counts working days, skipping weekends, closures and bank holidays", () => {
    const calendar = calendarOf([closure("2026-11-10")]);
    const terms = { ...TERMS, dayCount: "working" as const, freeDays: 5 };
    // Cleared Mon 2 Nov: working days Tue 3, Wed 4, Thu 5, Fri 6, (Mon 9) -> Mon 9 Nov is the 5th.
    expect(charge({ terms, calendar }).collectBy).toBe("2026-11-09");
    // With Tue 10 closed and 6 days: Mon 9 is the 5th, Tue 10 closed, Wed 11 the 6th.
    expect(charge({ terms: { ...terms, freeDays: 6 }, calendar }).collectBy).toBe("2026-11-11");
  });

  it("counts working days over a bank holiday", () => {
    const calendar = calendarOf(bankHolidayClosures([2026]));
    const terms = { ...TERMS, dayCount: "working" as const, freeDays: 2 };
    // Cleared Thu 24 Dec: Fri 25 and Mon 28 are bank holidays, so Tue 29 and Wed 30.
    expect(charge({ terms, calendar, clearedOn: "2026-12-24" }).collectBy).toBe("2026-12-30");
  });

  it("is the cleared day itself with no free days, if the gallery is open", () => {
    expect(charge({ terms: { ...TERMS, freeDays: 0 } }).collectBy).toBe("2026-11-02");
  });

  it("is later by every day the work was held (a pause)", () => {
    const pausedRanges = [{ from: "2026-11-05", to: "2026-11-07" }];
    // 14 days free from Mon 2 Nov, three paused days: Fri 20... Mon 16 + 3 = Thu 19 Nov.
    expect(charge({ pausedRanges }).collectBy).toBe("2026-11-19");
  });

  it("ignores a pause that ended before payment cleared", () => {
    const pausedRanges = [{ from: "2026-10-20", to: "2026-11-01" }];
    expect(charge({ pausedRanges }).collectBy).toBe("2026-11-16");
  });

  it("does not count a paused working day, nor a paused day that is a weekend", () => {
    const terms = { ...TERMS, dayCount: "working" as const, freeDays: 3 };
    // Working days after Mon 2: Tue 3 (1st), Wed 4 and Thu 5 paused, Fri 6 (2nd), Mon 9 (3rd).
    const pausedRanges = [{ from: "2026-11-04", to: "2026-11-05" }];
    expect(charge({ terms, pausedRanges }).collectBy).toBe("2026-11-09");
    // A paused weekend changes nothing: Sat 7 and Sun 8 are not working days anyway.
    expect(
      charge({ terms, pausedRanges: [{ from: "2026-11-07", to: "2026-11-08" }] }).collectBy,
    ).toBe("2026-11-05");
  });

  it("adds an extension, in calendar days, to the free period", () => {
    // Mon 16 Nov + 7 = Mon 23 Nov.
    expect(charge({ extensionDays: 7 }).collectBy).toBe("2026-11-23");
  });

  it("moves an extension that lands on a closed day to the next open day", () => {
    // Mon 16 + 5 = Sat 21 -> Mon 23.
    expect(charge({ extensionDays: 5 }).collectBy).toBe("2026-11-23");
  });

  it("does not count a paused day inside an extension", () => {
    const pausedRanges = [{ from: "2026-11-17", to: "2026-11-18" }];
    // Free ends Mon 16; extension 3 days skipping Tue 17, Wed 18: Thu 19, Fri 20, Sat 21 -> Mon 23.
    expect(charge({ extensionDays: 3, pausedRanges }).collectBy).toBe("2026-11-23");
  });

  it("counts days by London date across the clocks going back (a 25-hour day)", () => {
    // Clocks go back Sun 25 Oct 2026. Cleared Tue 20 Oct + 14 = Tue 3 Nov.
    expect(charge({ clearedOn: "2026-10-20" }).collectBy).toBe("2026-11-03");
    expect(charge({ clearedOn: "2026-10-20", asOf: "2026-11-04" }).chargeableDays).toBe(1);
  });

  it("counts days by London date across the clocks going forward (a 23-hour day)", () => {
    // Clocks go forward Sun 29 Mar 2026. Cleared Fri 20 Mar + 14 = Fri 3 Apr.
    expect(charge({ clearedOn: "2026-03-20" }).collectBy).toBe("2026-04-03");
    expect(charge({ clearedOn: "2026-03-20", asOf: "2026-04-05" }).chargeableDays).toBe(2);
  });

  it("starts from the London day an instant falls on, not the UTC day", () => {
    // 23:30 UTC on 9 Jun is 00:30 BST on 10 Jun.
    expect(storageClearedOn(new Date("2026-06-09T23:30:00Z"))).toBe("2026-06-10");
    expect(storageClearedOn(new Date("2026-11-09T23:30:00Z"))).toBe("2026-11-09");
  });
});

describe("the chargeable days and amount", () => {
  // Cleared Mon 2 Nov; collect by Mon 16 Nov; the first charged day is Tue 17 Nov.
  it("is nothing up to and including the collect-by day", () => {
    expect(charge({ asOf: "2026-11-16" })).toMatchObject({ chargeableDays: 0, amountPence: 0 });
  });

  it("is a day's charge on the day after", () => {
    expect(charge({ asOf: "2026-11-17" })).toMatchObject({ chargeableDays: 1, amountPence: 300 });
  });

  it("counts every calendar day, weekends included", () => {
    expect(charge({ asOf: "2026-11-30" })).toMatchObject({ chargeableDays: 14, amountPence: 4200 });
  });

  it("charges the large band at the large rate", () => {
    expect(charge({ asOf: "2026-11-19", band: "large" })).toMatchObject({
      chargeableDays: 3,
      amountPence: 1800,
    });
  });

  it("charges a large work the standard rate when the large band is off", () => {
    const terms = { ...TERMS, largeDailyPence: null };
    expect(charge({ asOf: "2026-11-19", band: "large", terms }).amountPence).toBe(900);
  });

  it("adds the handling fee once, when charges start, and not before", () => {
    const terms = { ...TERMS, handlingFeePence: 1500 };
    expect(charge({ terms, asOf: "2026-11-16" }).amountPence).toBe(0);
    expect(charge({ terms, asOf: "2026-11-17" }).amountPence).toBe(1800);
    expect(charge({ terms, asOf: "2026-11-19" }).amountPence).toBe(2400);
  });

  it("does not charge a day the work was held after the collect-by day", () => {
    const pausedRanges = [{ from: "2026-11-18", to: "2026-11-19" }];
    expect(charge({ asOf: "2026-11-21", pausedRanges })).toMatchObject({
      chargeableDays: 3,
      amountPence: 900,
    });
  });

  it("stops the free period moving when a pause starts after it", () => {
    const pausedRanges = [{ from: "2026-11-20", to: "2026-11-25" }];
    expect(charge({ asOf: "2026-11-30", pausedRanges }).collectBy).toBe("2026-11-16");
  });

  it("starts charging the day after a moved collect-by day, not after the nominal one", () => {
    // Cleared Sat 7 Nov: nominal Sat 21, collect by Mon 23, first charged day Tue 24.
    expect(charge({ clearedOn: "2026-11-07", asOf: "2026-11-23" }).chargeableDays).toBe(0);
    expect(charge({ clearedOn: "2026-11-07", asOf: "2026-11-24" }).chargeableDays).toBe(1);
  });

  it("is whole pence, whatever the rate", () => {
    const terms = { ...TERMS, standardDailyPence: 333 };
    expect(Number.isInteger(charge({ terms, asOf: "2026-12-30" }).amountPence)).toBe(true);
    expect(charge({ terms, asOf: "2026-11-19" }).amountPence).toBe(999);
  });

  it("charges nothing when the day rate is zero", () => {
    const terms = { ...TERMS, standardDailyPence: 0 };
    expect(charge({ terms, asOf: "2026-12-30" })).toMatchObject({
      chargeableDays: 44,
      amountPence: 0,
    });
  });

  it("charges nothing before payment cleared", () => {
    expect(charge({ asOf: "2026-10-01" })).toMatchObject({ chargeableDays: 0, amountPence: 0 });
  });
});

describe("the state", () => {
  it("is upcoming until a week before the collect-by day", () => {
    expect(charge({ asOf: "2026-11-08" }).state).toBe("upcoming");
  });

  it("is soon from a week before through the collect-by day", () => {
    expect(charge({ asOf: "2026-11-09" }).state).toBe("soon");
    expect(charge({ asOf: "2026-11-16" }).state).toBe("soon");
  });

  it("is charging from the day after", () => {
    expect(charge({ asOf: "2026-11-17" }).state).toBe("charging");
  });

  it("is extended while an extension is running, and charging once it has passed", () => {
    expect(charge({ extensionDays: 14, asOf: "2026-11-20" }).state).toBe("extended");
    expect(charge({ extensionDays: 14, asOf: "2026-11-30" }).state).toBe("extended");
    expect(charge({ extensionDays: 14, asOf: "2026-12-01" }).state).toBe("charging");
  });

  it("is waived when waived, with nothing to pay, whatever else is true", () => {
    expect(charge({ waived: true, asOf: "2026-12-30" })).toMatchObject({
      state: "waived",
      amountPence: 0,
    });
    expect(charge({ waived: true, asOf: "2026-11-03" }).state).toBe("waived");
  });

  it("has no early 'soon' when the free period is no longer than the lead", () => {
    const terms = { ...TERMS, freeDays: 7 };
    // Collect by Mon 9 Nov.
    expect(charge({ terms, asOf: "2026-11-03" }).state).toBe("upcoming");
    expect(charge({ terms, asOf: "2026-11-09" }).state).toBe("soon");
  });
});

describe("the terms sentence", () => {
  it("reads the lot page copy for the defaults", () => {
    expect(formatStorageTerms(TERMS)).toBe(
      "Storage is free for 14 days after your payment clears. After that it is £3 a day for each work, or £6 for works over 150 cm on any side, plus VAT where it applies.",
    );
  });

  it("shows pence on both rates when either has them", () => {
    expect(formatStorageTerms({ ...TERMS, standardDailyPence: 350, largeDailyPence: 700 })).toBe(
      "Storage is free for 14 days after your payment clears. After that it is £3.50 a day for each work, or £7.00 for works over 150 cm on any side, plus VAT where it applies.",
    );
  });

  it("says working days when they are counted", () => {
    expect(formatStorageTerms({ ...TERMS, dayCount: "working", freeDays: 10 })).toContain(
      "free for 10 working days",
    );
  });

  it("says one day in the singular", () => {
    expect(formatStorageTerms({ ...TERMS, freeDays: 1 })).toContain("free for 1 day after");
  });

  it("leaves out the large rate when the band is off", () => {
    expect(formatStorageTerms({ ...TERMS, largeDailyPence: null })).toBe(
      "Storage is free for 14 days after your payment clears. After that it is £3 a day for each work, plus VAT where it applies.",
    );
  });

  it("states a handling fee", () => {
    expect(formatStorageTerms({ ...TERMS, handlingFeePence: 1500 })).toContain(
      "A handling fee of £15 applies once when charges start.",
    );
  });

  it("says charges may apply when the rate is zero", () => {
    expect(formatStorageTerms({ ...TERMS, standardDailyPence: 0, largeDailyPence: null })).toBe(
      "Storage is free for 14 days after your payment clears. After that, storage charges may apply.",
    );
  });

  it("says there is no free period when the free days are zero", () => {
    expect(formatStorageTerms({ ...TERMS, freeDays: 0 })).toMatch(
      /^Storage is charged from the day after your payment clears\./,
    );
  });
});

describe("the running-total lines", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  const ctx = { placeName: "LAX Gallery", now, chargingOn: true };
  const notice = (over: Partial<StorageChargeInput>, chargingOn = true) =>
    formatStorageNotice(charge(over), TERMS, "standard", { ...ctx, chargingOn });

  it("upcoming", () => {
    expect(notice({ asOf: "2026-11-02" })).toEqual({
      heading: "Please collect by Mon 16 Nov",
      body: "Your work is paid for and waiting at LAX Gallery. Storage is free until then, and £3 a day after that, plus VAT where it applies.",
    });
  });

  it("soon", () => {
    expect(notice({ asOf: "2026-11-10" })).toEqual({
      heading: "Please collect by Mon 16 Nov",
      body: "Your work is paid for and waiting at LAX Gallery. Book a time to collect it soon: after Mon 16 Nov, storage is £3 a day.",
    });
  });

  it("charging, with the running total", () => {
    expect(notice({ asOf: "2026-11-19" })).toEqual({
      heading: "Storage charges since Tue 17 Nov",
      body: "£9.00 so far (3 days at £3 a day), plus VAT where it applies. Book a time to collect, and you will pay the storage up to that day when you book.",
    });
  });

  it("charging at the large rate names that rate", () => {
    const large = formatStorageNotice(
      charge({ asOf: "2026-11-18", band: "large" }),
      TERMS,
      "large",
      ctx,
    );
    expect(large.body).toContain("£12.00 so far (2 days at £6 a day)");
  });

  it("charging off keeps today's wording after the day", () => {
    expect(notice({ asOf: "2026-11-19" }, false)).toEqual({
      heading: "Please collect by Mon 16 Nov",
      body: "That day has passed, so storage charges may apply. Book a time to collect your work from LAX Gallery, or email us if you need longer.",
    });
  });

  it("charging off before the day reads as before (no rate promised)", () => {
    expect(notice({ asOf: "2026-11-02" }, false).body).toBe(
      "Your work is paid for and waiting at LAX Gallery. Storage is free until then, and storage charges may apply after that.",
    );
  });

  it("extended", () => {
    expect(notice({ extensionDays: 7, asOf: "2026-11-18" })).toEqual({
      heading: "Free storage extended to Mon 23 Nov",
      body: "We have held your work longer at no charge. Book a time to collect before then.",
    });
  });

  it("waived", () => {
    expect(notice({ waived: true, asOf: "2026-11-30" })).toEqual({
      heading: "No storage to pay",
      body: "We have waived the storage charges on this work. Book a time to collect.",
    });
  });

  it("list badge", () => {
    expect(formatStorageBadge(charge({ asOf: "2026-11-19" }), now, true)).toBe(
      "Collect by Mon 16 Nov · Storage £9.00 so far",
    );
    expect(formatStorageBadge(charge({ asOf: "2026-11-10" }), now, true)).toBe(
      "Collect by Mon 16 Nov",
    );
    expect(formatStorageBadge(charge({ asOf: "2026-11-19" }), now, false)).toBe(
      "Collect by Mon 16 Nov",
    );
  });

  it("invoice line", () => {
    expect(
      formatStorageInvoiceLine(
        { lotNumber: 12, from: "2026-11-17", to: "2026-11-19", days: 3, dailyPence: 300 },
        now,
      ),
    ).toBe("Storage, Lot 12 · Tue 17 Nov to Thu 19 Nov · 3 days at £3 a day");
  });

  it("hand-over desk line", () => {
    expect(formatStorageDeskLine(900)).toBe(
      "Storage of £9.00 is due on this lot. Take payment or waive it before hand-over.",
    );
  });
});
