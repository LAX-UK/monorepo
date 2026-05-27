import { describe, expect, it, vi } from "vitest";
import { DEFAULT_AUCTION_ZONE } from "../../lib/datetime/index.js";
import { applyPresetForTest } from "./date-range-picker.test-utils.js";

/** Preset boundaries use Europe/London calendar dates (see date-range-picker). */
describe("DateRangePicker presets", () => {
  it("uses London zone for today preset", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T12:00:00Z"));

    const range = applyPresetForTest("today", DEFAULT_AUCTION_ZONE);
    expect(range).toEqual({ from: "2026-05-27", to: "2026-05-27" });

    vi.useRealTimers();
  });

  it("uses London zone for 7d preset ending today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T12:00:00Z"));

    const range = applyPresetForTest("7d", DEFAULT_AUCTION_ZONE);
    expect(range).toEqual({ from: "2026-05-21", to: "2026-05-27" });

    vi.useRealTimers();
  });
});
