import { describe, expect, it } from "vitest";
import {
  addDaysToKey,
  daysBetweenKeys,
  formatCollectionDay,
  formatCollectionVisit,
  formatCollectionWhen,
  isDateKey,
  isoWeekday,
  londonDateKey,
  londonZoneLabel,
  parseLocalTime,
} from "./collection-time.js";

const at = (iso: string) => new Date(iso);
const NOW = at("2026-11-09T11:20:00Z");

describe("the one date style", () => {
  it("writes a moment as weekday, day, month, 24-hour time and zone", () => {
    expect(formatCollectionWhen(at("2026-11-12T04:49:00Z"), NOW)).toBe("Thu 12 Nov, 04:49 GMT");
    expect(formatCollectionWhen(at("2026-11-12T14:00:00Z"), NOW)).toBe("Thu 12 Nov, 14:00 GMT");
  });

  it("labels summer times BST", () => {
    expect(formatCollectionWhen(at("2026-04-01T13:00:00Z"), at("2026-03-01T00:00:00Z"))).toBe(
      "Wed 1 Apr, 14:00 BST",
    );
  });

  it("writes a day alone, and a visit as a range", () => {
    expect(formatCollectionDay(at("2026-11-12T14:00:00Z"), NOW)).toBe("Thu 12 Nov");
    expect(formatCollectionVisit(at("2026-11-12T14:00:00Z"), at("2026-11-12T14:30:00Z"), NOW)).toBe(
      "Thu 12 Nov, 14:00–14:30 GMT",
    );
  });

  it("adds the year only when it is not this year's", () => {
    expect(formatCollectionWhen(at("2027-01-14T10:00:00Z"), NOW)).toBe(
      "Thu 14 Jan 2027, 10:00 GMT",
    );
    expect(formatCollectionDay(at("2027-01-14T10:00:00Z"), NOW)).toBe("Thu 14 Jan 2027");
  });

  it("spells every month with three letters", () => {
    expect(formatCollectionDay(at("2026-09-03T09:00:00Z"), NOW)).toBe("Thu 3 Sep");
  });

  it("reads the London day, not the UTC day, around midnight", () => {
    // 23:30 UTC on 30 June is 00:30 BST on 1 July.
    expect(formatCollectionWhen(at("2026-06-30T23:30:00Z"), NOW)).toBe("Wed 1 Jul, 00:30 BST");
    expect(londonDateKey(at("2026-06-30T23:30:00Z"))).toBe("2026-07-01");
    expect(londonDateKey(at("2026-12-30T23:30:00Z"))).toBe("2026-12-30");
  });
});

describe("the clock changes", () => {
  it("switches from GMT to BST at 01:00 UTC on 29 March 2026", () => {
    expect(londonZoneLabel(at("2026-03-29T00:59:00Z"))).toBe("GMT");
    expect(londonZoneLabel(at("2026-03-29T01:00:00Z"))).toBe("BST");
    expect(formatCollectionWhen(at("2026-03-29T00:59:00Z"), NOW)).toBe("Sun 29 Mar, 00:59 GMT");
    expect(formatCollectionWhen(at("2026-03-29T01:00:00Z"), NOW)).toBe("Sun 29 Mar, 02:00 BST");
  });

  it("switches from BST to GMT at 01:00 UTC on 25 October 2026", () => {
    expect(londonZoneLabel(at("2026-10-25T00:59:00Z"))).toBe("BST");
    expect(londonZoneLabel(at("2026-10-25T01:00:00Z"))).toBe("GMT");
    expect(formatCollectionWhen(at("2026-10-25T00:30:00Z"), NOW)).toBe("Sun 25 Oct, 01:30 BST");
    expect(formatCollectionWhen(at("2026-10-25T01:30:00Z"), NOW)).toBe("Sun 25 Oct, 01:30 GMT");
  });
});

describe("day keys", () => {
  it("recognises real calendar days only", () => {
    expect(isDateKey("2026-11-12")).toBe(true);
    expect(isDateKey("2028-02-29")).toBe(true);
    expect(isDateKey("2026-02-29")).toBe(false);
    expect(isDateKey("2026-13-01")).toBe(false);
    expect(isDateKey("12/11/2026")).toBe(false);
  });

  it("adds days across month, year and leap-day edges", () => {
    expect(addDaysToKey("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDaysToKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToKey("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysToKey("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDaysToKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysToKey("2026-03-28", 2)).toBe("2026-03-30");
  });

  it("numbers weekdays from Monday as 1", () => {
    expect(isoWeekday("2026-11-09")).toBe(1);
    expect(isoWeekday("2026-11-13")).toBe(5);
    expect(isoWeekday("2026-11-15")).toBe(7);
  });

  it("counts whole days across a clock change", () => {
    expect(daysBetweenKeys("2026-03-28", "2026-03-30")).toBe(2);
    expect(daysBetweenKeys("2026-10-24", "2026-10-26")).toBe(2);
    expect(daysBetweenKeys("2026-11-12", "2026-11-09")).toBe(-3);
  });

  it("rejects a malformed key", () => {
    expect(() => addDaysToKey("tomorrow", 1)).toThrow(RangeError);
  });
});

describe("parseLocalTime", () => {
  it("reads 24-hour wall-clock times as minutes", () => {
    expect(parseLocalTime("00:00")).toBe(0);
    expect(parseLocalTime("10:00")).toBe(600);
    expect(parseLocalTime("16:00")).toBe(960);
    expect(parseLocalTime("23:59")).toBe(1439);
  });

  it("rejects anything else", () => {
    for (const bad of ["24:00", "9:00", "10:60", "10", "ten", ""]) {
      expect(parseLocalTime(bad)).toBeNull();
    }
  });
});
