import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_AUCTION_ZONE } from "../../lib/datetime/index.js";
import { DateRangePicker } from "./date-range-picker.js";
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

describe("DateRangePicker initial preset", () => {
  const empty = { from: "", to: "" };
  const isHighlighted = (name: string) =>
    screen.getByRole("button", { name }).className.includes("bg-primary");

  it("highlights 30d by default", () => {
    render(<DateRangePicker value={empty} onChange={() => {}} />);
    expect(isHighlighted("30d")).toBe(true);
  });

  it("highlights nothing when told the value did not come from a preset", () => {
    render(<DateRangePicker value={empty} onChange={() => {}} initialPreset={null} />);
    for (const name of ["Today", "7d", "30d", "90d", "Custom"]) {
      expect(isHighlighted(name), name).toBe(false);
    }
  });
});
