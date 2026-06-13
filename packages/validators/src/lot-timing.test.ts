import { describe, expect, it } from "vitest";
import { normalizeLotTime, normalizeLotTimingFields, toLotCardTimingVM } from "./lot-timing.js";

describe("normalizeLotTime", () => {
  it("returns ISO strings for valid dates and strings", () => {
    expect(normalizeLotTime("2026-06-01T12:00:00.000Z")).toBe("2026-06-01T12:00:00.000Z");
    expect(normalizeLotTime(new Date("2026-06-01T12:00:00.000Z"))).toBe("2026-06-01T12:00:00.000Z");
  });

  it("returns null for missing, invalid, or empty values", () => {
    expect(normalizeLotTime(null)).toBeNull();
    expect(normalizeLotTime(undefined)).toBeNull();
    expect(normalizeLotTime("")).toBeNull();
    expect(normalizeLotTime("not-a-date")).toBeNull();
    expect(normalizeLotTime(new Date(Number.NaN))).toBeNull();
  });
});

describe("toLotCardTimingVM", () => {
  it("maps status and normalized timing fields", () => {
    expect(
      toLotCardTimingVM({
        status: "active",
        startTime: "2026-01-01T00:00:00.000Z",
        endTime: null,
      }),
    ).toEqual({
      status: "active",
      startTime: "2026-01-01T00:00:00.000Z",
      endTime: null,
    });
  });

  it("normalizes both fields via normalizeLotTimingFields", () => {
    expect(
      normalizeLotTimingFields({
        startTime: "2026-01-01T00:00:00.000Z",
        endTime: new Date("2026-01-02T00:00:00.000Z"),
      }),
    ).toEqual({
      startTime: "2026-01-01T00:00:00.000Z",
      endTime: "2026-01-02T00:00:00.000Z",
    });
  });
});
