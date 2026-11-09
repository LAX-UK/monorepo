import { describe, expect, it } from "vitest";
import type { CollectionException } from "./collection-calendar.js";
import {
  type LiveBooking,
  bankHolidayYears,
  bookingsAffectedBy,
  exceptionDraftIssues,
  normaliseWeeklyHours,
  saleDayClosures,
  weeklyHoursIssues,
} from "./collection-settings.js";

const at = (iso: string) => new Date(iso);
const day = (weekday: number, opensLocal: string, closesLocal: string) => ({
  weekday,
  opensLocal,
  closesLocal,
});
const GALLERY = [1, 2, 3, 4, 5].map((weekday) => day(weekday, "10:00", "19:00"));

describe("weeklyHoursIssues", () => {
  it("accepts the gallery's week, and a day split in two", () => {
    expect(weeklyHoursIssues(GALLERY)).toEqual([]);
    expect(weeklyHoursIssues([day(2, "10:00", "13:00"), day(2, "14:00", "19:00")])).toEqual([]);
    expect(weeklyHoursIssues([])).toEqual([]);
  });

  it("marks the range whose closing is not after its opening", () => {
    expect(weeklyHoursIssues([day(5, "10:00", "09:00")])).toEqual([
      { weekday: 5, index: 0, code: "closes_not_after_opens" },
    ]);
    expect(weeklyHoursIssues([day(5, "10:00", "10:00")])).toEqual([
      { weekday: 5, index: 0, code: "closes_not_after_opens" },
    ]);
  });

  it("marks a time that is not HH:MM, and a weekday that is not 1 to 7", () => {
    expect(weeklyHoursIssues([day(1, "9am", "19:00")])).toEqual([
      { weekday: 1, index: 0, code: "time_invalid" },
    ]);
    expect(weeklyHoursIssues([day(1, "10:00", "24:00")])[0]?.code).toBe("time_invalid");
    expect(weeklyHoursIssues([day(0, "10:00", "19:00")])[0]?.code).toBe("weekday_invalid");
    expect(weeklyHoursIssues([day(8, "10:00", "19:00")])[0]?.code).toBe("weekday_invalid");
  });

  it("marks ranges on one day that overlap or touch, whichever order they were given", () => {
    expect(weeklyHoursIssues([day(3, "10:00", "14:00"), day(3, "13:00", "19:00")])).toEqual([
      { weekday: 3, index: 1, code: "overlap" },
    ]);
    // The later range in time is the one marked, wherever it sits in the list.
    expect(weeklyHoursIssues([day(3, "14:00", "19:00"), day(3, "10:00", "14:00")])).toEqual([
      { weekday: 3, index: 0, code: "overlap" },
    ]);
  });

  it("does not mix up two different days", () => {
    expect(weeklyHoursIssues([day(1, "10:00", "14:00"), day(2, "10:00", "14:00")])).toEqual([]);
  });

  it("allows up to four ranges a day and no more", () => {
    const four = [
      ["08:00", "09:00"],
      ["10:00", "11:00"],
      ["12:00", "13:00"],
      ["14:00", "15:00"],
    ].map(([o, c]) => day(1, o as string, c as string));
    expect(weeklyHoursIssues(four)).toEqual([]);
    expect(weeklyHoursIssues([...four, day(1, "16:00", "17:00")])).toEqual([
      { weekday: 1, index: 4, code: "too_many_ranges" },
    ]);
  });

  it("reports every problem, each with its own range", () => {
    const issues = weeklyHoursIssues([
      day(1, "19:00", "10:00"),
      day(2, "10:00", "12:00"),
      day(2, "11:00", "13:00"),
    ]);
    expect(issues).toEqual([
      { weekday: 1, index: 0, code: "closes_not_after_opens" },
      { weekday: 2, index: 1, code: "overlap" },
    ]);
  });
});

describe("normaliseWeeklyHours", () => {
  it("orders by weekday then opening time, without changing the input", () => {
    const input = [day(2, "14:00", "19:00"), day(1, "10:00", "19:00"), day(2, "10:00", "13:00")];
    expect(normaliseWeeklyHours(input)).toEqual([
      day(1, "10:00", "19:00"),
      day(2, "10:00", "13:00"),
      day(2, "14:00", "19:00"),
    ]);
    expect(input[0]).toEqual(day(2, "14:00", "19:00"));
  });
});

describe("exceptionDraftIssues", () => {
  const draft = (over: Partial<Parameters<typeof exceptionDraftIssues>[0]> = {}) => ({
    kind: "closure" as const,
    startsOn: "2026-12-24",
    endsOn: "2026-12-24",
    opensLocal: null,
    closesLocal: null,
    ...over,
  });

  it("accepts a day, a run of days and a part of a day", () => {
    expect(exceptionDraftIssues(draft())).toEqual([]);
    expect(exceptionDraftIssues(draft({ endsOn: "2026-12-31" }))).toEqual([]);
    expect(exceptionDraftIssues(draft({ opensLocal: "13:00", closesLocal: "14:00" }))).toEqual([]);
  });

  it("refuses dates that are not real days", () => {
    for (const startsOn of ["2026-02-30", "24/12/2026", "", "2026-13-01"]) {
      expect(exceptionDraftIssues(draft({ startsOn }))).toEqual(["date_invalid"]);
    }
    expect(exceptionDraftIssues(draft({ endsOn: "soon" }))).toEqual(["date_invalid"]);
  });

  it("refuses a run that ends before it starts, or lasts more than a year", () => {
    expect(exceptionDraftIssues(draft({ endsOn: "2026-12-23" }))).toEqual(["ends_before_start"]);
    expect(exceptionDraftIssues(draft({ startsOn: "2026-01-01", endsOn: "2027-01-02" }))).toEqual([
      "too_long",
    ]);
    expect(exceptionDraftIssues(draft({ startsOn: "2026-01-01", endsOn: "2026-12-31" }))).toEqual(
      [],
    );
  });

  it("needs both times or neither, in order", () => {
    expect(exceptionDraftIssues(draft({ opensLocal: "13:00" }))).toEqual(["hours_incomplete"]);
    expect(exceptionDraftIssues(draft({ closesLocal: "13:00" }))).toEqual(["hours_incomplete"]);
    expect(exceptionDraftIssues(draft({ opensLocal: "14:00", closesLocal: "13:00" }))).toEqual([
      "closes_not_after_opens",
    ]);
    expect(exceptionDraftIssues(draft({ opensLocal: "1pm", closesLocal: "14:00" }))).toEqual([
      "time_invalid",
    ]);
  });
});

describe("saleDayClosures", () => {
  const sale = (over: Record<string, unknown> = {}) => ({
    id: "sale-1",
    title: "Winter Works on Paper: Live",
    startTime: at("2026-11-26T14:00:00Z"),
    endTime: at("2026-11-26T20:00:00Z"),
    deliveryMode: "hybrid" as const,
    status: "scheduled" as const,
    ...over,
  });

  it("closes the London days of a live or hybrid sale, with the sale named", () => {
    const [closure] = saleDayClosures([sale()]);
    expect(closure).toMatchObject({
      kind: "closure",
      startsOn: "2026-11-26",
      endsOn: "2026-11-26",
      opensLocal: null,
      closesLocal: null,
      source: "sale",
      saleId: "sale-1",
      saleTitle: "Winter Works on Paper: Live",
    });
    expect(saleDayClosures([sale({ deliveryMode: "onsite" })])).toHaveLength(1);
  });

  it("closes nothing for an online sale, a draft or a cancelled one", () => {
    expect(saleDayClosures([sale({ deliveryMode: "online" })])).toEqual([]);
    expect(saleDayClosures([sale({ status: "draft" })])).toEqual([]);
    expect(saleDayClosures([sale({ status: "cancelled" })])).toEqual([]);
    expect(saleDayClosures([sale({ status: "active" }), sale({ status: "ended" })])).toHaveLength(
      2,
    );
  });

  it("spans every day of a sale that runs over several, in London time", () => {
    const [closure] = saleDayClosures([
      sale({ startTime: at("2026-06-30T23:30:00Z"), endTime: at("2026-07-02T10:00:00Z") }),
    ]);
    // 23:30 UTC on 30 June is already 1 July in London.
    expect(closure).toMatchObject({ startsOn: "2026-07-01", endsOn: "2026-07-02" });
  });

  it("never ends before it starts", () => {
    const [closure] = saleDayClosures([
      sale({ startTime: at("2026-11-26T14:00:00Z"), endTime: at("2026-11-25T14:00:00Z") }),
    ]);
    expect(closure?.endsOn).toBe("2026-11-26");
  });
});

describe("bookingsAffectedBy", () => {
  const booking = (
    id: string,
    start: string,
    end: string,
    over: Partial<LiveBooking> = {},
  ): LiveBooking => ({
    id,
    reference: `COL-${id}`,
    slotStart: at(start),
    slotEnd: at(end),
    seat: 1,
    overCapacity: false,
    ...over,
  });
  const next = (over: Partial<Parameters<typeof bookingsAffectedBy>[1]> = {}) => ({
    hours: GALLERY,
    exceptions: [] as CollectionException[],
    rules: { closeOnSaleDays: true, placesPerSlot: 2 },
    ...over,
  });
  const closure = (
    startsOn: string,
    hours: [string, string] | null = null,
  ): CollectionException => ({
    kind: "closure",
    startsOn,
    endsOn: startsOn,
    opensLocal: hours?.[0] ?? null,
    closesLocal: hours?.[1] ?? null,
    source: "staff",
  });

  it("finds nothing when every booking still fits", () => {
    const fits = [
      booking("1001", "2026-11-12T10:00:00Z", "2026-11-12T10:30:00Z"),
      booking("1002", "2026-11-12T18:30:00Z", "2026-11-12T19:00:00Z"),
    ];
    expect(bookingsAffectedBy(fits, next())).toEqual([]);
  });

  it("finds a booking that falls after the new closing time", () => {
    const late = booking("1003", "2026-11-13T17:30:00Z", "2026-11-13T18:00:00Z");
    const earlier = [1, 2, 3, 4, 5].map((weekday) => day(weekday, "10:00", "17:00"));
    expect(bookingsAffectedBy([late], next({ hours: earlier }))).toEqual([
      { bookingId: "1003", reference: "COL-1003", reason: "outside_hours" },
    ]);
  });

  it("keeps a booking that ends exactly at closing time, and finds one that runs past it", () => {
    const hours = [1, 2, 3, 4, 5].map((weekday) => day(weekday, "10:00", "17:00"));
    const touching = booking("1", "2026-11-13T16:30:00Z", "2026-11-13T17:00:00Z");
    const over = booking("2", "2026-11-13T16:45:00Z", "2026-11-13T17:15:00Z");
    expect(bookingsAffectedBy([touching, over], next({ hours })).map((a) => a.bookingId)).toEqual([
      "2",
    ]);
  });

  it("finds a booking on a day that is now closed", () => {
    const monday = booking("1", "2026-11-16T10:00:00Z", "2026-11-16T10:30:00Z");
    const noMonday = GALLERY.filter((h) => h.weekday !== 1);
    expect(bookingsAffectedBy([monday], next({ hours: noMonday }))).toEqual([
      { bookingId: "1", reference: "COL-1", reason: "closed" },
    ]);
  });

  it("finds bookings under a closure, whole-day or part-day, and not the ones clear of it", () => {
    const morning = booking("1", "2026-11-10T10:00:00Z", "2026-11-10T10:30:00Z");
    const lunch = booking("2", "2026-11-10T13:00:00Z", "2026-11-10T13:30:00Z");
    const after = booking("3", "2026-11-10T14:00:00Z", "2026-11-10T14:30:00Z");
    const partDay = bookingsAffectedBy(
      [morning, lunch, after],
      next({ exceptions: [closure("2026-11-10", ["13:00", "14:00"])] }),
    );
    expect(partDay).toEqual([{ bookingId: "2", reference: "COL-2", reason: "outside_hours" }]);
    const wholeDay = bookingsAffectedBy(
      [morning, lunch, after],
      next({ exceptions: [closure("2026-11-10")] }),
    );
    expect(wholeDay.map((a) => a.reason)).toEqual(["closed", "closed", "closed"]);
  });

  it("judges a summer booking by London time, not UTC", () => {
    // 17:30 BST is 16:30 UTC; the gallery closes at 17:00 London time, so this is past closing.
    const summer = booking("1", "2026-06-16T16:30:00Z", "2026-06-16T17:00:00Z");
    const hours = [1, 2, 3, 4, 5].map((weekday) => day(weekday, "10:00", "17:00"));
    expect(bookingsAffectedBy([summer], next({ hours }))).toHaveLength(1);
    // The same instant in winter is 16:30 London time and fits.
    const winter = booking("2", "2026-12-15T16:30:00Z", "2026-12-15T17:00:00Z");
    expect(bookingsAffectedBy([winter], next({ hours }))).toEqual([]);
  });

  it("finds a booking whose place number is above the new places at once, except a deliberate override", () => {
    const third = booking("1", "2026-11-12T10:00:00Z", "2026-11-12T10:30:00Z", { seat: 3 });
    const override = booking("2", "2026-11-12T11:00:00Z", "2026-11-12T11:30:00Z", {
      seat: 3,
      overCapacity: true,
    });
    const affected = bookingsAffectedBy(
      [third, override],
      next({ rules: { closeOnSaleDays: true, placesPerSlot: 2 } }),
    );
    expect(affected).toEqual([{ bookingId: "1", reference: "COL-1", reason: "over_capacity" }]);
  });

  it("lists them by reference, and an extra opening saves a booking on an otherwise closed day", () => {
    const saturday = booking("9", "2026-11-14T10:00:00Z", "2026-11-14T10:30:00Z");
    const monday = booking("1", "2026-11-16T10:00:00Z", "2026-11-16T10:30:00Z");
    const opening: CollectionException = {
      kind: "extra_opening",
      startsOn: "2026-11-14",
      endsOn: "2026-11-14",
      opensLocal: "10:00",
      closesLocal: "12:00",
      source: "staff",
    };
    const noMonday = GALLERY.filter((h) => h.weekday !== 1);
    const affected = bookingsAffectedBy(
      [saturday, monday],
      next({ hours: noMonday, exceptions: [opening] }),
    );
    expect(affected.map((a) => a.bookingId)).toEqual(["1"]);
  });
});

describe("bankHolidayYears", () => {
  it("is this year and the next two, by the London year", () => {
    expect(bankHolidayYears(at("2026-11-09T12:00:00Z"))).toEqual([2026, 2027, 2028]);
    // New Year's Eve in the evening UTC is already 2027 in London in summer time only if later;
    // 23:30 UTC on 31 December is still 2026 in London (GMT).
    expect(bankHolidayYears(at("2026-12-31T23:30:00Z"))).toEqual([2026, 2027, 2028]);
    expect(bankHolidayYears(at("2027-01-01T00:00:00Z"))).toEqual([2027, 2028, 2029]);
  });

  it("takes a different number of years ahead", () => {
    expect(bankHolidayYears(at("2026-11-09T12:00:00Z"), 0)).toEqual([2026]);
  });
});
