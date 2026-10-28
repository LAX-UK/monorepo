import { describe, expect, it } from "vitest";
import { staffRoleAssignmentEndsWithin } from "./staff-role-assignment.js";

const NOW = new Date("2026-10-28T12:00:00Z");
const DAY = 86_400_000;
const inDays = (days: number) => new Date(NOW.getTime() + days * DAY);

describe("staffRoleAssignmentEndsWithin", () => {
  it("is true for an end date inside the window", () => {
    expect(staffRoleAssignmentEndsWithin({ endsAt: inDays(1) }, NOW, 30)).toBe(true);
    expect(staffRoleAssignmentEndsWithin({ endsAt: inDays(30) }, NOW, 30)).toBe(true);
  });

  it("is false for open-ended, later and past ends", () => {
    expect(staffRoleAssignmentEndsWithin({ endsAt: null }, NOW, 30)).toBe(false);
    expect(staffRoleAssignmentEndsWithin({ endsAt: inDays(31) }, NOW, 30)).toBe(false);
    expect(staffRoleAssignmentEndsWithin({ endsAt: inDays(-1) }, NOW, 30)).toBe(false);
    expect(staffRoleAssignmentEndsWithin({ endsAt: NOW }, NOW, 30)).toBe(false);
  });
});
