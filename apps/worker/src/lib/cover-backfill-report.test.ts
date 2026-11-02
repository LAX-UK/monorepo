import { describe, expect, it } from "vitest";
import { summarisePictures } from "./cover-backfill-report.js";
import { coverSlotVerdict, lotPlateVerdict } from "./cover-picture-verdict.js";

describe("lotPlateVerdict", () => {
  it("accepts a photograph whose long side reaches 800 px, in either orientation", () => {
    expect(lotPlateVerdict({ width: 800, height: 500 }).ok).toBe(true);
    expect(lotPlateVerdict({ width: 500, height: 800 }).ok).toBe(true);
  });

  it("refuses a smaller photograph and says what it needed", () => {
    expect(lotPlateVerdict({ width: 799, height: 600 })).toEqual({
      ok: false,
      reason: "below_plate_floor",
      need: "long side 800 px",
      have: "799 × 600",
    });
  });
});

describe("coverSlotVerdict", () => {
  it("holds the default slot to 2400 px wide and the wide and phone slots to their boxes", () => {
    expect(coverSlotVerdict("default", { width: 2400, height: 900 }).ok).toBe(true);
    expect(coverSlotVerdict("default", { width: 2399, height: 2000 }).ok).toBe(false);
    expect(coverSlotVerdict("wide", { width: 2880, height: 1079 }).ok).toBe(false);
    expect(coverSlotVerdict("phone", { width: 1200, height: 1200 }).ok).toBe(true);
  });
});

describe("summarisePictures", () => {
  it("counts usable, below-floor and unreadable pictures and lists the skipped ones", () => {
    const summary = summarisePictures([
      { role: "lot-primary", source: "a", verdict: { ok: true } },
      { role: "lot-primary", source: "b", verdict: lotPlateVerdict({ width: 400, height: 300 }) },
      {
        role: "sale-cover",
        source: "c",
        verdict: { ok: false, reason: "unreadable", error: "external_picture_status_404" },
      },
    ]);
    expect(summary).toMatchObject({
      measured: 2,
      usable: 1,
      skippedBelowFloor: 1,
      unreadable: 1,
    });
    expect(summary.skipped.map((entry) => entry.source)).toEqual(["b", "c"]);
    expect(summary.skipped[0]?.detail).toBe("need long side 800 px, have 400 × 300");
  });
});
