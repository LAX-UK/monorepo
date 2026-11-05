import { pinClock } from "@/test/pin-clock";
import { describe, expect, it } from "vitest";
import { formatAdminUserDate } from "./format-admin-user-date";

pinClock();

describe("formatAdminUserDate", () => {
  it("formats a London day with a three-letter month", () => {
    expect(formatAdminUserDate("2026-05-11T12:00:00.000Z")).toBe("Mon 11 May");
  });

  it("writes September as Sep, never Sept", () => {
    expect(formatAdminUserDate("2026-09-30T12:00:00.000Z")).toBe("Wed 30 Sep");
  });

  it("returns unparseable input unchanged", () => {
    expect(formatAdminUserDate("not a date")).toBe("not a date");
  });
});
