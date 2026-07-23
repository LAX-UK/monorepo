import { describe, expect, it } from "vitest";
import { formatAdminRelativeTimeLabel } from "./format-admin-relative-time.js";

describe("formatAdminRelativeTimeLabel", () => {
  it("formats recent timestamps", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    expect(formatAdminRelativeTimeLabel(new Date("2026-06-01T11:30:00Z"), now)).toBe("30m ago");
  });

  it("returns null for invalid values", () => {
    expect(formatAdminRelativeTimeLabel("not-a-date")).toBeNull();
  });
});
