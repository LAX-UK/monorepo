import { describe, expect, it } from "vitest";
import {
  type CollectionException,
  type CollectionWeeklyHours,
  bankHolidayClosures,
  createCollectionCalendar,
  noticeDeadline,
  noticeWindow,
  workingDayBefore,
} from "./collection-calendar.js";
import { DEFAULT_COLLECTION_RULES } from "./collection-rules.js";

const at = (iso: string) => new Date(iso);

/** Monday to Friday, 10:00 to 19:00. */
const GALLERY_HOURS: CollectionWeeklyHours[] = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  opensLocal: "10:00",
  closesLocal: "19:00",
}));

const closure = (
  startsOn: string,
  source: CollectionException["source"] = "staff",
  endsOn = startsOn,
  hours: [string, string] | null = null,
): CollectionException => ({
  kind: "closure",
  startsOn,
  endsOn,
  opensLocal: hours?.[0] ?? null,
  closesLocal: hours?.[1] ?? null,
  source,
});

const opening = (
  startsOn: string,
  hours: [string, string] | null = null,
  endsOn = startsOn,
): CollectionException => ({
  kind: "extra_opening",
  startsOn,
  endsOn,
  opensLocal: hours?.[0] ?? null,
  closesLocal: hours?.[1] ?? null,
  source: "staff",
});

const calendarOf = (
  exceptions: CollectionException[] = [],
  rules: { closeOnSaleDays: boolean } = DEFAULT_COLLECTION_RULES,
) => createCollectionCalendar({ hours: GALLERY_HOURS, exceptions, rules });

const UK_2026 = bankHolidayClosures([2026]);

describe("bankHolidayClosures", () => {
  it("makes one whole-day closure per England and Wales bank holiday", () => {
    expect(UK_2026.map((c) => c.startsOn)).toEqual([
      "2026-01-01",
      "2026-04-03",
      "2026-04-06",
      "2026-05-04",
      "2026-05-25",
      "2026-08-31",
      "2026-12-25",
      "2026-12-28",
    ]);
    expect(UK_2026.every((c) => c.kind === "closure" && c.source === "bank_holiday")).toBe(true);
    expect(UK_2026.every((c) => c.opensLocal === null && c.closesLocal === null)).toBe(true);
  });
});

describe("the day plan", () => {
  it("opens on weekdays for the weekly hours", () => {
    expect(calendarOf().plan("2026-11-10")).toEqual({
      kind: "open",
      ranges: [{ opens: 600, closes: 1140 }],
      closedRanges: [],
    });
  });

  it("closes at the weekend", () => {
    expect(calendarOf().plan("2026-11-14")).toEqual({ kind: "closed", reason: "closed" });
    expect(calendarOf().plan("2026-11-15")).toEqual({ kind: "closed", reason: "closed" });
  });

  it("closes on bank holidays", () => {
    expect(calendarOf(UK_2026).plan("2026-12-28")).toEqual({ kind: "closed", reason: "closed" });
  });

  it("closes on a sale day, and says so", () => {
    expect(calendarOf([closure("2026-11-18", "sale")]).plan("2026-11-18")).toEqual({
      kind: "closed",
      reason: "sale_day",
    });
  });

  it("ignores sale days at a place that stays open on them", () => {
    const calendar = calendarOf([closure("2026-11-18", "sale")], { closeOnSaleDays: false });
    expect(calendar.plan("2026-11-18").kind).toBe("open");
  });

  it("lets staff open a sale day anyway, on the regular hours", () => {
    const calendar = calendarOf([closure("2026-11-18", "sale"), opening("2026-11-18")]);
    expect(calendar.plan("2026-11-18")).toEqual({
      kind: "open",
      ranges: [{ opens: 600, closes: 1140 }],
      closedRanges: [],
    });
  });

  it("opens a bank holiday for set hours only, not the regular ones", () => {
    const calendar = calendarOf([...UK_2026, opening("2026-12-28", ["10:00", "14:00"])]);
    expect(calendar.plan("2026-12-28")).toEqual({
      kind: "open",
      ranges: [{ opens: 600, closes: 840 }],
      closedRanges: [],
    });
  });

  it("adds an extra opening on a day with no regular hours", () => {
    const calendar = calendarOf([opening("2026-12-19", ["10:00", "16:00"])]);
    expect(calendar.plan("2026-12-19")).toEqual({
      kind: "open",
      ranges: [{ opens: 600, closes: 960 }],
      closedRanges: [],
    });
  });

  it("keeps an extra opening without hours on a weekend closed", () => {
    expect(calendarOf([opening("2026-12-19")]).plan("2026-12-19").kind).toBe("closed");
  });

  it("adds split ranges for the same day", () => {
    const calendar = createCollectionCalendar({
      hours: [
        { weekday: 2, opensLocal: "10:00", closesLocal: "13:00" },
        { weekday: 2, opensLocal: "14:00", closesLocal: "19:00" },
      ],
      exceptions: [],
      rules: DEFAULT_COLLECTION_RULES,
    });
    expect(calendar.plan("2026-11-10")).toMatchObject({
      ranges: [
        { opens: 600, closes: 780 },
        { opens: 840, closes: 1140 },
      ],
    });
  });

  it("lets a staff closure win over an opening and a sale override", () => {
    const calendar = calendarOf([
      closure("2026-11-18", "sale"),
      opening("2026-11-18"),
      closure("2026-11-18"),
    ]);
    expect(calendar.plan("2026-11-18")).toEqual({ kind: "closed", reason: "closed" });
  });

  it("reports a bank holiday on a sale day as closed, not as a sale day", () => {
    const calendar = calendarOf([closure("2026-12-28", "sale"), ...UK_2026]);
    expect(calendar.plan("2026-12-28")).toEqual({ kind: "closed", reason: "closed" });
  });

  it("closes only part of a day for a closure with hours", () => {
    const calendar = calendarOf([closure("2026-11-10", "staff", "2026-11-10", ["13:00", "14:00"])]);
    expect(calendar.plan("2026-11-10")).toEqual({
      kind: "open",
      ranges: [{ opens: 600, closes: 1140 }],
      closedRanges: [{ opens: 780, closes: 840 }],
    });
  });

  it("covers every day of a run, both ends included", () => {
    const calendar = calendarOf([closure("2026-11-10", "staff", "2026-11-12")]);
    expect(calendar.plan("2026-11-09").kind).toBe("open");
    expect(calendar.plan("2026-11-10").kind).toBe("closed");
    expect(calendar.plan("2026-11-12").kind).toBe("closed");
    expect(calendar.plan("2026-11-13").kind).toBe("open");
  });

  it("ignores hours it cannot read", () => {
    const calendar = createCollectionCalendar({
      hours: [
        { weekday: 1, opensLocal: "19:00", closesLocal: "10:00" },
        { weekday: 1, opensLocal: "soon", closesLocal: "later" },
      ],
      exceptions: [],
      rules: DEFAULT_COLLECTION_RULES,
    });
    expect(calendar.plan("2026-11-09")).toEqual({ kind: "closed", reason: "closed" });
  });
});

describe("working days", () => {
  it("are Monday to Friday", () => {
    const calendar = calendarOf();
    expect(calendar.isWorkingDay("2026-11-13")).toBe(true);
    expect(calendar.isWorkingDay("2026-11-14")).toBe(false);
    expect(calendar.isWorkingDay("2026-11-15")).toBe(false);
  });

  it("exclude bank holidays and whole-day closures", () => {
    const calendar = calendarOf([...UK_2026, closure("2026-11-11")]);
    expect(calendar.isWorkingDay("2026-12-25")).toBe(false);
    expect(calendar.isWorkingDay("2026-11-11")).toBe(false);
  });

  it("exclude sale days only while the place closes on them", () => {
    const sale = [closure("2026-11-18", "sale")];
    expect(calendarOf(sale).isWorkingDay("2026-11-18")).toBe(false);
    expect(calendarOf(sale, { closeOnSaleDays: false }).isWorkingDay("2026-11-18")).toBe(true);
  });

  it("stay working days when only some hours are closed", () => {
    const calendar = calendarOf([closure("2026-11-10", "staff", "2026-11-10", ["13:00", "14:00"])]);
    expect(calendar.isWorkingDay("2026-11-10")).toBe(true);
  });

  it("count back over weekends and holidays", () => {
    const calendar = calendarOf(UK_2026);
    expect(workingDayBefore(calendar, "2026-11-10", 1)).toBe("2026-11-09");
    expect(workingDayBefore(calendar, "2026-11-09", 1)).toBe("2026-11-06");
    expect(workingDayBefore(calendar, "2026-12-29", 1)).toBe("2026-12-24");
    expect(workingDayBefore(calendar, "2026-11-12", 2)).toBe("2026-11-10");
  });

  it("give up on a calendar closed for months", () => {
    const calendar = calendarOf([closure("2026-01-01", "staff", "2027-12-31")]);
    expect(workingDayBefore(calendar, "2026-11-10", 1)).toBeNull();
  });
});

describe("the notice deadline: 16:00 London time on the working day before", () => {
  const rules = DEFAULT_COLLECTION_RULES;
  const deadline = (slot: string, exceptions: CollectionException[] = []) =>
    noticeDeadline(at(slot), rules, calendarOf(exceptions))?.toISOString();

  it("is Monday 16:00 for a Tuesday visit", () => {
    expect(deadline("2026-11-10T10:00:00Z")).toBe("2026-11-09T16:00:00.000Z");
  });

  it("is Friday 16:00 for a Monday visit", () => {
    expect(deadline("2026-11-16T10:00:00Z")).toBe("2026-11-13T16:00:00.000Z");
  });

  it("is the same for every visit on the day", () => {
    expect(deadline("2026-11-10T18:30:00Z")).toBe("2026-11-09T16:00:00.000Z");
  });

  it("skips bank holidays: Christmas week", () => {
    // Tuesday 29 Dec: Monday 28 and Friday 25 are holidays, so Thursday 24.
    expect(deadline("2026-12-29T10:00:00Z", UK_2026)).toBe("2026-12-24T16:00:00.000Z");
    expect(deadline("2026-12-29T10:00:00Z")).toBe("2026-12-28T16:00:00.000Z");
  });

  it("skips Easter: Tuesday after Easter Monday", () => {
    // 7 April 2026 is in summer time, so 16:00 BST is 15:00 UTC on Thursday 2 April.
    expect(deadline("2026-04-07T09:00:00Z", UK_2026)).toBe("2026-04-02T15:00:00.000Z");
  });

  it("skips a closure, and a sale day while it closes the place", () => {
    expect(deadline("2026-11-12T10:00:00Z", [closure("2026-11-11")])).toBe(
      "2026-11-10T16:00:00.000Z",
    );
    expect(deadline("2026-11-19T10:00:00Z", [closure("2026-11-18", "sale")])).toBe(
      "2026-11-17T16:00:00.000Z",
    );
  });

  it("counts back over the spring clock change", () => {
    // Clocks go forward on Sunday 29 March. Monday 30 March visits are in BST (09:00 UTC); the
    // deadline is Friday 27 March 16:00 GMT.
    expect(deadline("2026-03-30T09:00:00Z")).toBe("2026-03-27T16:00:00.000Z");
    // Tuesday's deadline is Monday 16:00 BST, which is 15:00 UTC.
    expect(deadline("2026-03-31T09:00:00Z")).toBe("2026-03-30T15:00:00.000Z");
  });

  it("counts back over the autumn clock change", () => {
    // Clocks go back on Sunday 25 October. Friday 23 October 16:00 is still BST.
    expect(deadline("2026-10-26T10:00:00Z")).toBe("2026-10-23T15:00:00.000Z");
    // Monday 26 October 16:00 is GMT.
    expect(deadline("2026-10-27T10:00:00Z")).toBe("2026-10-26T16:00:00.000Z");
  });

  it("honours a set cut-off time and number of working days", () => {
    const custom = { noticeCutoffLocal: "12:00", noticeWorkingDays: 2 };
    expect(noticeDeadline(at("2026-11-12T10:00:00Z"), custom, calendarOf())?.toISOString()).toBe(
      "2026-11-10T12:00:00.000Z",
    );
  });

  it("has no deadline for a cut-off it cannot read, so nothing is bookable", () => {
    const broken = { noticeCutoffLocal: "four", noticeWorkingDays: 1 };
    expect(noticeDeadline(at("2026-11-10T10:00:00Z"), broken, calendarOf())).toBeNull();
    expect(
      noticeWindow(at("2026-11-09T09:00:00Z"), at("2026-11-10T10:00:00Z"), broken, calendarOf()),
    ).toEqual({
      open: false,
      deadline: null,
    });
  });
});

describe("the notice window at the boundary", () => {
  const slot = at("2026-11-10T10:00:00Z");
  const window = (now: string) =>
    noticeWindow(at(now), slot, DEFAULT_COLLECTION_RULES, calendarOf());

  it("is open a minute before 16:00", () => {
    expect(window("2026-11-09T15:59:00Z").open).toBe(true);
  });

  it("is still open at 16:00 exactly", () => {
    expect(window("2026-11-09T16:00:00.000Z").open).toBe(true);
  });

  it("is closed a moment after 16:00", () => {
    expect(window("2026-11-09T16:00:00.001Z").open).toBe(false);
    expect(window("2026-11-09T16:01:00Z").open).toBe(false);
  });

  it("reports the deadline either way", () => {
    expect(window("2026-11-09T17:00:00Z").deadline?.toISOString()).toBe("2026-11-09T16:00:00.000Z");
  });

  it("follows the clock in summer: 16:00 BST is 15:00 UTC", () => {
    const summer = at("2026-06-16T09:00:00Z");
    const inWindow = (now: string) =>
      noticeWindow(at(now), summer, DEFAULT_COLLECTION_RULES, calendarOf()).open;
    expect(inWindow("2026-06-15T15:00:00Z")).toBe(true);
    expect(inWindow("2026-06-15T15:00:00.001Z")).toBe(false);
  });
});
