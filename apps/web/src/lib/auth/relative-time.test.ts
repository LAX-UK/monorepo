import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./relative-time.js";

describe("formatRelativeTime", () => {
  it("describes past times in the past tense", () => {
    const now = new Date("2026-05-15T14:00:00.000Z");
    const oneHourAgo = "2026-05-15T13:00:00.000Z";
    const out = formatRelativeTime(oneHourAgo, now);
    expect(out).toMatch(/hour/);
  });

  it("handles invalid iso gracefully", () => {
    const now = new Date("2026-05-15T14:00:00.000Z");
    expect(formatRelativeTime("not-a-date", now)).toBe("not-a-date");
  });
});
