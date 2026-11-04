import { describe, expect, it } from "vitest";
import { formatAdminUserDate } from "./format-admin-user-date";

describe("formatAdminUserDate", () => {
  it("formats a London day with a three-letter month", () => {
    expect(formatAdminUserDate("2026-05-11T12:00:00.000Z")).toBe("11 May 2026");
  });

  it("writes September as Sep, never Sept", () => {
    expect(formatAdminUserDate("2026-09-30T12:00:00.000Z")).toBe("30 Sep 2026");
  });

  it("returns unparseable input unchanged", () => {
    expect(formatAdminUserDate("not a date")).toBe("not a date");
  });
});
