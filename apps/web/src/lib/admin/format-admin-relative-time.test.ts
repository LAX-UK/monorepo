import { describe, expect, it } from "vitest";
import { formatAdminRelativeTimeLabel } from "./format-admin-relative-time";

const NOW = new Date("2026-10-27T12:00:00Z");

describe("formatAdminRelativeTimeLabel", () => {
  it("reads recent moments as elapsed time", () => {
    expect(formatAdminRelativeTimeLabel(new Date("2026-10-27T11:30:00Z"), NOW)).toBe("30m ago");
    expect(formatAdminRelativeTimeLabel(new Date("2026-10-27T09:00:00Z"), NOW)).toBe("3h ago");
    expect(formatAdminRelativeTimeLabel("2026-10-20T12:00:00Z", NOW)).toBe("7d ago");
  });

  it("uses the house date for anything older, in London time", () => {
    expect(formatAdminRelativeTimeLabel("2026-10-01T12:00:00Z", NOW)).toBe("Thu 1 Oct");
    // 23:30 UTC on 30 Jun is already 1 Jul in London (BST).
    expect(formatAdminRelativeTimeLabel("2026-06-30T23:30:00Z", NOW)).toBe("Wed 1 Jul");
  });

  it("adds the year when it is not the current one", () => {
    expect(formatAdminRelativeTimeLabel("2025-12-24T12:00:00Z", NOW)).toBe("Wed 24 Dec 2025");
  });

  it("returns null for missing or invalid values", () => {
    expect(formatAdminRelativeTimeLabel(null, NOW)).toBeNull();
    expect(formatAdminRelativeTimeLabel("nope", NOW)).toBeNull();
  });
});
