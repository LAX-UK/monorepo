import { describe, expect, it } from "vitest";
import { isoWeekday } from "./collection-journey-ids.js";
import { collectionJourneyVisits, londonDay, londonInstant } from "./collection-journey-visits.js";

describe("London wall-clock times", () => {
  it("is the same as UTC in winter and an hour earlier in summer", () => {
    expect(londonInstant("2026-11-12", "14:00").toISOString()).toBe("2026-11-12T14:00:00.000Z");
    expect(londonInstant("2026-06-12", "14:00").toISOString()).toBe("2026-06-12T13:00:00.000Z");
  });

  it("holds on the days the clocks change", () => {
    expect(londonInstant("2026-03-29", "14:00").toISOString()).toBe("2026-03-29T13:00:00.000Z");
    expect(londonInstant("2026-10-25", "14:00").toISOString()).toBe("2026-10-25T14:00:00.000Z");
  });

  it("reads the London day of an instant, not the UTC day", () => {
    expect(londonDay(new Date("2026-06-11T23:30:00Z"))).toBe("2026-06-12");
    expect(londonDay(new Date("2026-11-12T23:30:00Z"))).toBe("2026-11-12");
  });
});

describe("where each seeded visit falls", () => {
  const visits = collectionJourneyVisits(new Date("2026-11-10T09:00:00Z"));

  it("puts the visits the buyer changes and cancels far enough ahead to be changed online", () => {
    expect(visits.toChange.day).toBe("2026-11-16");
    expect(visits.toCancel.day).toBe("2026-11-17");
    expect(visits.toHandOver.day).toBe("2026-11-12");
    expect(visits.unreleased.start.toISOString()).toBe("2026-11-12T11:30:00.000Z");
  });

  it("puts the visits staff close in the past", () => {
    expect(visits.noShow.day).toBe("2026-11-09");
    expect(visits.missed.day).toBe("2026-11-06");
    expect(visits.collected.day).toBe("2026-11-09");
    expect(visits.partlyCollected.day).toBe("2026-11-05");
    for (const past of [visits.noShow, visits.missed, visits.collected, visits.partlyCollected]) {
      expect(past.start.getTime()).toBeLessThan(new Date("2026-11-10T09:00:00Z").getTime());
    }
  });

  it("never puts two live visits in the same place at the same time", () => {
    const live = [
      visits.toChange,
      visits.toCancel,
      visits.toHandOver,
      visits.unreleased,
      visits.noShow,
    ];
    const starts = live.map((v) => v.start.toISOString());
    expect(new Set(starts).size).toBe(starts.length);
  });

  it("keeps every visit on a working day within gallery hours", () => {
    for (const v of Object.values(visits)) {
      expect(isoWeekday(v.day)).toBeLessThanOrEqual(5);
      expect(v.end.getTime() - v.start.getTime()).toBe(30 * 60_000);
    }
  });
});
