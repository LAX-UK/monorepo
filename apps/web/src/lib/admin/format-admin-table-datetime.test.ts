import { describe, expect, it } from "vitest";
import { formatAdminTableDateTime } from "./format-admin-table-datetime";

const NOW = new Date("2026-05-18T12:00:00Z");

describe("formatAdminTableDateTime", () => {
  it("returns empty presentation for invalid values", () => {
    expect(formatAdminTableDateTime(null, "timestamp", { now: NOW }).primary).toBe("—");
    expect(formatAdminTableDateTime("not-a-date", "deadline", { now: NOW }).primary).toBe("—");
  });

  it("formats timestamp mode within 24h as relative only", () => {
    const twoHoursAgo = new Date("2026-05-18T10:00:00Z");
    const out = formatAdminTableDateTime(twoHoursAgo, "timestamp", { now: NOW });
    expect(out.primary).toBe("2h ago");
    expect(out.secondary).toBeNull();
    expect(out.iso).toBe(twoHoursAgo.toISOString());
  });

  it("formats timestamp mode at 23h as relative only", () => {
    const twentyThreeHoursAgo = new Date("2026-05-17T13:00:00Z");
    const out = formatAdminTableDateTime(twentyThreeHoursAgo, "timestamp", { now: NOW });
    expect(out.primary).toBe("23h ago");
    expect(out.secondary).toBeNull();
  });

  it("formats timestamp mode at 25h as absolute date only", () => {
    const twentyFiveHoursAgo = new Date("2026-05-17T11:00:00Z");
    const out = formatAdminTableDateTime(twentyFiveHoursAgo, "timestamp", { now: NOW });
    expect(out.primary).toMatch(/17 May/);
    expect(out.primary).not.toContain("ago");
    expect(out.secondary).toBeNull();
  });

  it("formats timestamp mode weeks ago as absolute date only", () => {
    const fourWeeksAgo = new Date("2026-04-20T12:00:00Z");
    const out = formatAdminTableDateTime(fourWeeksAgo, "timestamp", { now: NOW });
    expect(out.primary).toMatch(/20 Apr/);
    expect(out.primary).not.toContain("ago");
    expect(out.secondary).toBeNull();
  });

  it("formats dateOnly mode without secondary line", () => {
    const out = formatAdminTableDateTime("2026-03-01T09:00:00Z", "dateOnly", { now: NOW });
    expect(out.primary).toMatch(/1 Mar 26/);
    expect(out.primary).not.toContain("2026");
    expect(out.secondary).toBeNull();
    expect(out.title).toContain("2026");
  });

  it("uses 2-digit year on cross-year timestamp primary when older than 24h", () => {
    const out = formatAdminTableDateTime("2025-05-19T14:30:00Z", "timestamp", { now: NOW });
    expect(out.primary).toMatch(/19 May 25/);
    expect(out.primary).not.toContain("2025");
    expect(out.secondary).toBeNull();
  });

  it("formats future deadline as compact In … copy", () => {
    const inTwoHours = new Date("2026-05-18T14:00:00Z");
    const out = formatAdminTableDateTime(inTwoHours, "deadline", { now: NOW });
    expect(out.primary).toBe("In 2h");
    expect(out.urgency).toBe("soon");
  });

  it("formats past end deadline with Ended prefix", () => {
    const twoDaysAgo = new Date("2026-05-16T12:00:00Z");
    const out = formatAdminTableDateTime(twoDaysAgo, "deadline", { now: NOW });
    expect(out.primary).toBe("Ended 2d ago");
    expect(out.urgency).toBe("past");
  });

  it("formats past start deadline with Started prefix", () => {
    const twoDaysAgo = new Date("2026-05-16T12:00:00Z");
    const out = formatAdminTableDateTime(twoDaysAgo, "deadline", {
      now: NOW,
      deadlineKind: "start",
    });
    expect(out.primary).toBe("Started 2d ago");
  });
});
