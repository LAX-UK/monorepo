import { describe, expect, it } from "vitest";
import {
  countdownTier,
  formatCountdownAriaLabel,
  formatCountdownForDisplay,
} from "./format-countdown";

describe("countdownTier", () => {
  it("is critical under 10 minutes", () => {
    expect(countdownTier(9 * 60 * 1000)).toBe("critical");
  });
  it("is urgent under 1 hour but not under 10m rule", () => {
    expect(countdownTier(30 * 60 * 1000)).toBe("urgent");
  });
  it("is normal at 2 hours", () => {
    expect(countdownTier(2 * 60 * 60 * 1000)).toBe("normal");
  });
});

describe("formatCountdownAriaLabel", () => {
  it("describes multi-day windows", () => {
    const label = formatCountdownAriaLabel(2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000);
    expect(label).toContain("Closes in");
    expect(label).toMatch(/day/);
  });
});

describe("formatCountdownForDisplay", () => {
  it("still formats under 24h as clock", () => {
    expect(formatCountdownForDisplay(90 * 60 * 1000 + 30_000)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});
