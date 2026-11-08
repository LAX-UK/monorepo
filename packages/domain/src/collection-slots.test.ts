import { describe, expect, it } from "vitest";
import {
  type CollectionException,
  type CollectionWeeklyHours,
  bankHolidayClosures,
} from "./collection-calendar.js";
import { DEFAULT_COLLECTION_RULES } from "./collection-rules.js";
import {
  type CollectionDay,
  type CollectionSlotsInput,
  collectionSlots,
  earliestOpenSlot,
  slotRefusal,
} from "./collection-slots.js";

const at = (iso: string) => new Date(iso);

const GALLERY_HOURS: CollectionWeeklyHours[] = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  opensLocal: "10:00",
  closesLocal: "19:00",
}));

/** Monday 9 November 2026, 11:20 GMT: the example in the design. */
const MONDAY_MORNING = at("2026-11-09T11:20:00Z");

const closure = (
  startsOn: string,
  source: CollectionException["source"] = "staff",
  hours: [string, string] | null = null,
): CollectionException => ({
  kind: "closure",
  startsOn,
  endsOn: startsOn,
  opensLocal: hours?.[0] ?? null,
  closesLocal: hours?.[1] ?? null,
  source,
});

const opening = (startsOn: string, hours: [string, string] | null = null): CollectionException => ({
  kind: "extra_opening",
  startsOn,
  endsOn: startsOn,
  opensLocal: hours?.[0] ?? null,
  closesLocal: hours?.[1] ?? null,
  source: "staff",
});

const slotsFor = (over: Partial<CollectionSlotsInput> = {}): CollectionDay[] =>
  collectionSlots({
    hours: GALLERY_HOURS,
    exceptions: [],
    rules: DEFAULT_COLLECTION_RULES,
    now: MONDAY_MORNING,
    ...over,
  });

const dayOf = (days: CollectionDay[], date: string): CollectionDay => {
  const day = days.find((d) => d.date === date);
  if (!day) throw new Error(`No day ${date}`);
  return day;
};

const starts = (day: CollectionDay) => day.slots.map((s) => s.start.toISOString());

describe("the gallery week", () => {
  const days = slotsFor();

  it("covers 28 days from today, in order", () => {
    expect(days).toHaveLength(28);
    expect(days[0]?.date).toBe("2026-11-09");
    expect(days[27]?.date).toBe("2026-12-06");
  });

  it("offers 18 half-hour visits from 10:00 to 19:00, the last at 18:30", () => {
    const tuesday = dayOf(days, "2026-11-10");
    expect(tuesday.slots).toHaveLength(18);
    expect(tuesday.slots[0]?.start.toISOString()).toBe("2026-11-10T10:00:00.000Z");
    expect(tuesday.slots[0]?.end.toISOString()).toBe("2026-11-10T10:30:00.000Z");
    expect(tuesday.slots[17]?.start.toISOString()).toBe("2026-11-10T18:30:00.000Z");
    expect(tuesday.slots[17]?.end.toISOString()).toBe("2026-11-10T19:00:00.000Z");
  });

  it("gives every visit two places", () => {
    expect(dayOf(days, "2026-11-10").slots.every((s) => s.placesLeft === 2)).toBe(true);
  });

  it("closes at the weekend and says so", () => {
    for (const date of ["2026-11-14", "2026-11-15"]) {
      expect(dayOf(days, date)).toMatchObject({ state: "closed", openSlots: 0, slots: [] });
    }
  });

  it("opens on Monday morning with Tuesday as the earliest time", () => {
    expect(earliestOpenSlot(days)?.start.toISOString()).toBe("2026-11-10T10:00:00.000Z");
  });

  it("marks today too soon: the deadline for today was Friday 16:00", () => {
    expect(dayOf(days, "2026-11-09")).toMatchObject({ state: "too_soon", openSlots: 0 });
    expect(dayOf(days, "2026-11-09").slots.every((s) => s.state === "too_soon")).toBe(true);
  });

  it("reads as open with its count of times", () => {
    expect(dayOf(days, "2026-11-10")).toMatchObject({ state: "open", openSlots: 18 });
  });
});

describe("the lead time before the first bookable visit", () => {
  const earliest = (now: string) =>
    earliestOpenSlot(slotsFor({ now: at(now) }))?.start.toISOString();

  it("moves to Wednesday after 16:00 on Monday", () => {
    expect(earliest("2026-11-09T16:30:00Z")).toBe("2026-11-11T10:00:00.000Z");
  });

  it("keeps Tuesday open at 16:00 on the dot, and loses it a moment later", () => {
    expect(earliest("2026-11-09T15:59:00Z")).toBe("2026-11-10T10:00:00.000Z");
    expect(earliest("2026-11-09T16:00:00.000Z")).toBe("2026-11-10T10:00:00.000Z");
    expect(earliest("2026-11-09T16:00:00.001Z")).toBe("2026-11-11T10:00:00.000Z");
  });

  it("makes Friday 16:00 the deadline for Monday", () => {
    expect(earliest("2026-11-13T16:00:00Z")).toBe("2026-11-16T10:00:00.000Z");
    expect(earliest("2026-11-13T16:01:00Z")).toBe("2026-11-17T10:00:00.000Z");
  });

  it("lets a weekend pass without opening Monday", () => {
    expect(earliest("2026-11-14T09:00:00Z")).toBe("2026-11-17T10:00:00.000Z");
    expect(earliest("2026-11-15T23:59:00Z")).toBe("2026-11-17T10:00:00.000Z");
  });

  it("marks a day too soon once every one of its visits is past its deadline", () => {
    const days = slotsFor({ now: at("2026-11-09T16:30:00Z") });
    expect(dayOf(days, "2026-11-10")).toMatchObject({ state: "too_soon", openSlots: 0 });
    expect(dayOf(days, "2026-11-11").state).toBe("open");
  });
});

describe("the booking window", () => {
  it("stops after the window and starts today", () => {
    const days = slotsFor({ rules: { ...DEFAULT_COLLECTION_RULES, windowDays: 14 } });
    expect(days).toHaveLength(14);
    expect(days.at(-1)?.date).toBe("2026-11-22");
  });

  it("counts today in London, not in UTC", () => {
    // 23:30 UTC on 30 June is 00:30 BST on 1 July.
    const days = slotsFor({ now: at("2026-06-30T23:30:00Z") });
    expect(days[0]?.date).toBe("2026-07-01");
  });

  it("has no earliest visit when nothing in the window is open", () => {
    const days = slotsFor({ hours: [] });
    expect(earliestOpenSlot(days)).toBeNull();
    expect(days.every((d) => d.state === "closed")).toBe(true);
  });
});

describe("visit length and the closing edge", () => {
  const tuesday = (visitMinutes: number, hours = GALLERY_HOURS) =>
    dayOf(slotsFor({ hours, rules: { ...DEFAULT_COLLECTION_RULES, visitMinutes } }), "2026-11-10");

  it("fits whole 45-minute visits and drops the part visit", () => {
    const day = tuesday(45);
    expect(day.slots).toHaveLength(12);
    expect(day.slots.at(-1)?.start.toISOString()).toBe("2026-11-10T18:15:00.000Z");
    expect(day.slots.at(-1)?.end.toISOString()).toBe("2026-11-10T19:00:00.000Z");
  });

  it("offers no visit that would run past closing time", () => {
    const hours: CollectionWeeklyHours[] = [
      { weekday: 2, opensLocal: "10:00", closesLocal: "18:30" },
    ];
    const day = tuesday(60, hours);
    expect(day.slots).toHaveLength(8);
    expect(day.slots.at(-1)?.end.toISOString()).toBe("2026-11-10T18:00:00.000Z");
  });

  it("offers nothing when the range is shorter than a visit", () => {
    const hours: CollectionWeeklyHours[] = [
      { weekday: 2, opensLocal: "10:00", closesLocal: "10:20" },
    ];
    expect(tuesday(30, hours)).toMatchObject({ state: "closed", slots: [] });
  });

  it("handles 15-minute visits", () => {
    expect(tuesday(15).slots).toHaveLength(36);
  });
});

describe("split hours and extra openings", () => {
  it("skips the gap between two ranges", () => {
    const hours: CollectionWeeklyHours[] = [
      { weekday: 2, opensLocal: "10:00", closesLocal: "13:00" },
      { weekday: 2, opensLocal: "14:00", closesLocal: "19:00" },
    ];
    const day = dayOf(slotsFor({ hours }), "2026-11-10");
    expect(day.slots).toHaveLength(6 + 10);
    expect(starts(day)).not.toContain("2026-11-10T13:00:00.000Z");
    expect(starts(day)).toContain("2026-11-10T14:00:00.000Z");
  });

  it("does not offer a visit twice where ranges overlap", () => {
    const hours: CollectionWeeklyHours[] = [
      { weekday: 2, opensLocal: "10:00", closesLocal: "13:00" },
      { weekday: 2, opensLocal: "12:00", closesLocal: "15:00" },
    ];
    const day = dayOf(slotsFor({ hours }), "2026-11-10");
    expect(day.slots).toHaveLength(10);
    expect(new Set(starts(day)).size).toBe(10);
    expect(starts(day)).toEqual([...starts(day)].sort());
  });

  it("adds a Saturday opening, with Friday 16:00 as its deadline", () => {
    const days = slotsFor({ exceptions: [opening("2026-11-14", ["10:00", "12:00"])] });
    const saturday = dayOf(days, "2026-11-14");
    expect(saturday).toMatchObject({ state: "open", openSlots: 4 });
    const early = slotsFor({
      exceptions: [opening("2026-11-14", ["10:00", "12:00"])],
      now: at("2026-11-13T16:01:00Z"),
    });
    expect(dayOf(early, "2026-11-14").state).toBe("too_soon");
  });
});

describe("closures", () => {
  it("closes a bank holiday and moves the deadline past it", () => {
    const exceptions = bankHolidayClosures([2026]);
    const now = at("2026-12-24T15:59:00Z");
    const days = slotsFor({ exceptions, now });
    expect(dayOf(days, "2026-12-25").state).toBe("closed");
    expect(dayOf(days, "2026-12-28").state).toBe("closed");
    // Thursday 24 December 16:00 is the deadline for Tuesday 29 December.
    expect(dayOf(days, "2026-12-29").state).toBe("open");
    const late = slotsFor({ exceptions, now: at("2026-12-24T16:01:00Z") });
    expect(dayOf(late, "2026-12-29").state).toBe("too_soon");
    expect(dayOf(late, "2026-12-30").state).toBe("open");
  });

  it("closes Good Friday and Easter Monday", () => {
    const days = slotsFor({
      exceptions: bankHolidayClosures([2026]),
      now: at("2026-03-30T09:00:00Z"),
    });
    expect(dayOf(days, "2026-04-03").state).toBe("closed");
    expect(dayOf(days, "2026-04-06").state).toBe("closed");
    expect(dayOf(days, "2026-04-07").state).toBe("open");
  });

  it("shows a sale day as a sale day", () => {
    const days = slotsFor({ exceptions: [closure("2026-11-18", "sale")] });
    expect(dayOf(days, "2026-11-18")).toMatchObject({ state: "sale_day", slots: [] });
  });

  it("does not close for a sale at a place that stays open on sale days", () => {
    const days = slotsFor({
      exceptions: [closure("2026-11-18", "sale")],
      rules: { ...DEFAULT_COLLECTION_RULES, closeOnSaleDays: false },
    });
    expect(dayOf(days, "2026-11-18").state).toBe("open");
  });

  it("lets staff open a sale day anyway", () => {
    const days = slotsFor({ exceptions: [closure("2026-11-18", "sale"), opening("2026-11-18")] });
    expect(dayOf(days, "2026-11-18")).toMatchObject({ state: "open", openSlots: 18 });
  });

  it("closes a staff closure for the whole day", () => {
    const days = slotsFor({ exceptions: [closure("2026-11-11")] });
    expect(dayOf(days, "2026-11-11")).toMatchObject({ state: "closed", slots: [] });
  });

  it("removes only the visits a part-day closure overlaps", () => {
    const days = slotsFor({ exceptions: [closure("2026-11-10", "staff", ["13:00", "14:00"])] });
    const tuesday = dayOf(days, "2026-11-10");
    expect(tuesday.slots).toHaveLength(16);
    expect(starts(tuesday)).toContain("2026-11-10T12:30:00.000Z");
    expect(starts(tuesday)).not.toContain("2026-11-10T13:00:00.000Z");
    expect(starts(tuesday)).not.toContain("2026-11-10T13:30:00.000Z");
    expect(starts(tuesday)).toContain("2026-11-10T14:00:00.000Z");
  });

  it("removes a visit that a closure only partly overlaps", () => {
    const days = slotsFor({ exceptions: [closure("2026-11-10", "staff", ["13:15", "13:45"])] });
    const tuesday = dayOf(days, "2026-11-10");
    expect(starts(tuesday)).not.toContain("2026-11-10T13:00:00.000Z");
    expect(starts(tuesday)).not.toContain("2026-11-10T13:30:00.000Z");
    expect(tuesday.slots).toHaveLength(16);
  });

  it("reads a day closed when a part-day closure covers all its hours", () => {
    const days = slotsFor({ exceptions: [closure("2026-11-10", "staff", ["09:00", "20:00"])] });
    expect(dayOf(days, "2026-11-10")).toMatchObject({ state: "closed", slots: [] });
  });
});

describe("capacity", () => {
  const first = "2026-11-10T10:00:00.000Z";
  const taken = (entries: [string, number][]) =>
    new Map(entries.map(([iso, count]) => [Date.parse(iso), count] as const));

  it("leaves one place when one of two is taken", () => {
    const day = dayOf(slotsFor({ takenPlaces: taken([[first, 1]]) }), "2026-11-10");
    expect(day.slots[0]).toMatchObject({ placesLeft: 1, state: "open" });
  });

  it("marks a visit full when every place is taken", () => {
    const day = dayOf(slotsFor({ takenPlaces: taken([[first, 2]]) }), "2026-11-10");
    expect(day.slots[0]).toMatchObject({ placesLeft: 0, state: "full" });
    expect(day).toMatchObject({ state: "open", openSlots: 17 });
  });

  it("never shows a negative count when staff booked over capacity", () => {
    const day = dayOf(slotsFor({ takenPlaces: taken([[first, 3]]) }), "2026-11-10");
    expect(day.slots[0]).toMatchObject({ placesLeft: 0, state: "full" });
  });

  it("reads a day full when every visit is taken", () => {
    const all = taken(
      dayOf(slotsFor(), "2026-11-10").slots.map((s): [string, number] => [
        s.start.toISOString(),
        2,
      ]),
    );
    const days = slotsFor({ takenPlaces: all });
    expect(dayOf(days, "2026-11-10")).toMatchObject({ state: "full", openSlots: 0 });
    expect(earliestOpenSlot(days)?.start.toISOString()).toBe("2026-11-11T10:00:00.000Z");
  });

  it("follows the places a staff member sets", () => {
    const rules = { ...DEFAULT_COLLECTION_RULES, placesPerSlot: 3 };
    const day = dayOf(slotsFor({ rules, takenPlaces: taken([[first, 2]]) }), "2026-11-10");
    expect(day.slots[0]).toMatchObject({ placesLeft: 1, state: "open" });
    expect(day.slots[1]).toMatchObject({ placesLeft: 3, state: "open" });
  });

  it("lets a visit past its deadline read too soon even when it is full", () => {
    const days = slotsFor({
      now: at("2026-11-09T16:30:00Z"),
      takenPlaces: taken([[first, 2]]),
    });
    expect(dayOf(days, "2026-11-10").slots[0]?.state).toBe("too_soon");
  });

  it("has no open place when the whole window is taken", () => {
    const everything = new Map(
      slotsFor()
        .flatMap((d) => d.slots)
        .map((s) => [s.start.getTime(), 2] as const),
    );
    expect(earliestOpenSlot(slotsFor({ takenPlaces: everything }))).toBeNull();
  });
});

describe("the clock changes", () => {
  it("shifts visits an hour earlier in UTC after the spring change", () => {
    const now = at("2026-03-23T09:00:00Z");
    const days = slotsFor({ now });
    // Friday 27 March is GMT, Monday 30 March is BST.
    expect(dayOf(days, "2026-03-27").slots[0]?.start.toISOString()).toBe(
      "2026-03-27T10:00:00.000Z",
    );
    expect(dayOf(days, "2026-03-30").slots[0]?.start.toISOString()).toBe(
      "2026-03-30T09:00:00.000Z",
    );
    expect(dayOf(days, "2026-03-30").slots.at(-1)?.end.toISOString()).toBe(
      "2026-03-30T18:00:00.000Z",
    );
    expect(dayOf(days, "2026-03-30").slots).toHaveLength(18);
  });

  it("shifts visits an hour later in UTC after the autumn change", () => {
    const now = at("2026-10-19T09:00:00Z");
    const days = slotsFor({ now });
    expect(dayOf(days, "2026-10-23").slots[0]?.start.toISOString()).toBe(
      "2026-10-23T09:00:00.000Z",
    );
    expect(dayOf(days, "2026-10-26").slots[0]?.start.toISOString()).toBe(
      "2026-10-26T10:00:00.000Z",
    );
    expect(dayOf(days, "2026-10-26").slots).toHaveLength(18);
  });

  it("keeps the deadlines at 16:00 London time across the change", () => {
    const now = at("2026-03-27T15:59:00Z");
    expect(dayOf(slotsFor({ now }), "2026-03-30").state).toBe("open");
    expect(dayOf(slotsFor({ now: at("2026-03-27T16:01:00Z") }), "2026-03-30").state).toBe(
      "too_soon",
    );
    // Monday 30 March 16:00 is BST, so the Tuesday deadline is 15:00 UTC.
    expect(dayOf(slotsFor({ now: at("2026-03-30T14:59:00Z") }), "2026-03-31").state).toBe("open");
    expect(dayOf(slotsFor({ now: at("2026-03-30T15:01:00Z") }), "2026-03-31").state).toBe(
      "too_soon",
    );
  });

  it("builds visits from real elapsed time on the day the clocks go forward", () => {
    // An extra opening 00:30 to 03:00 local on 29 March: 01:00 to 02:00 does not exist, so
    // only 1.5 hours pass, which is three half-hour visits.
    const days = slotsFor({
      now: at("2026-03-23T09:00:00Z"),
      exceptions: [opening("2026-03-29", ["00:30", "03:00"])],
    });
    expect(starts(dayOf(days, "2026-03-29"))).toEqual([
      "2026-03-29T00:30:00.000Z",
      "2026-03-29T01:00:00.000Z",
      "2026-03-29T01:30:00.000Z",
    ]);
  });

  it("builds visits from real elapsed time on the day the clocks go back", () => {
    // 00:30 to 03:00 local on 25 October: the hour from 01:00 to 02:00 happens twice, so
    // 3.5 hours pass, which is seven visits. The first starts at 00:30 BST, the evening before
    // in UTC, and still belongs to the London day.
    const days = slotsFor({
      now: at("2026-10-19T09:00:00Z"),
      exceptions: [opening("2026-10-25", ["00:30", "03:00"])],
    });
    const sunday = dayOf(days, "2026-10-25");
    expect(sunday.slots).toHaveLength(7);
    expect(sunday.slots[0]?.start.toISOString()).toBe("2026-10-24T23:30:00.000Z");
    expect(sunday.slots.at(-1)?.end.toISOString()).toBe("2026-10-25T03:00:00.000Z");
  });

  it("keeps Sunday openings for the change day apart from Saturday's", () => {
    const days = slotsFor({
      now: at("2026-10-19T09:00:00Z"),
      exceptions: [opening("2026-10-25", ["00:30", "03:00"])],
    });
    expect(dayOf(days, "2026-10-24").slots).toHaveLength(0);
  });
});

describe("slotRefusal", () => {
  const days = slotsFor({
    takenPlaces: new Map([[Date.parse("2026-11-10T11:00:00Z"), 2]]),
  });

  it("accepts an open visit", () => {
    expect(slotRefusal(days, at("2026-11-10T10:00:00Z"))).toBeNull();
  });

  it("refuses a full visit", () => {
    expect(slotRefusal(days, at("2026-11-10T11:00:00Z"))).toBe("slot_full");
  });

  it("refuses a visit past its deadline", () => {
    expect(slotRefusal(days, at("2026-11-09T10:00:00Z"))).toBe("notice_passed");
  });

  it("refuses a time the place does not offer", () => {
    expect(slotRefusal(days, at("2026-11-10T10:15:00Z"))).toBe("unknown_slot");
    expect(slotRefusal(days, at("2026-11-14T10:00:00Z"))).toBe("unknown_slot");
    expect(slotRefusal(days, at("2026-11-10T19:00:00Z"))).toBe("unknown_slot");
  });

  it("refuses a time beyond the window", () => {
    expect(slotRefusal(days, at("2026-12-07T10:00:00Z"))).toBe("unknown_slot");
  });
});
