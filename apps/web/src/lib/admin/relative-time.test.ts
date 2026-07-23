import { describe, expect, it } from "vitest";
import { daysSinceIso, relativeFromIso } from "./relative-time";

describe("relativeFromIso", () => {
  it("formats recent times in English", () => {
    const now = new Date("2026-05-18T12:00:00Z");
    const twoHoursAgo = new Date("2026-05-18T10:00:00Z").toISOString();
    expect(relativeFromIso(twoHoursAgo, now)).toBe("2h ago");
  });

  it("returns just now for sub-minute deltas", () => {
    const now = new Date("2026-05-18T12:00:00Z");
    const recent = new Date("2026-05-18T11:59:30Z").toISOString();
    expect(relativeFromIso(recent, now)).toBe("just now");
  });

  it("falls back to absolute date with 2-digit year after five weeks", () => {
    const now = new Date("2026-05-18T12:00:00Z");
    const old = new Date("2026-03-01T09:00:00Z").toISOString();
    expect(relativeFromIso(old, now)).toMatch(/1 Mar 26/);
    expect(relativeFromIso(old, now)).not.toContain("2026");
  });
});

describe("daysSinceIso", () => {
  it("counts whole days between dates", () => {
    const now = new Date("2026-05-18T12:00:00Z");
    const created = new Date("2026-05-11T12:00:00Z").toISOString();
    expect(daysSinceIso(created, now)).toBe(7);
  });
});
