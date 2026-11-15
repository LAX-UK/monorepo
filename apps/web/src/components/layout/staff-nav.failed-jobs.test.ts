import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import type { UserStaffRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import { getStaffNavGroups } from "./staff-nav";

function groupsFor(role: "staff" | "client", staffRole: UserStaffRole | null) {
  return getStaffNavGroups(role, 0, staffRole ? [staffRole] : []);
}

describe("staff nav: Failed jobs", () => {
  it.each<UserStaffRole>(["administrator", "read_only", "finance"])(
    "is offered to %s",
    (staffRole) => {
      const operations = groupsFor("staff", staffRole).find((group) => group.id === "operations");
      expect(operations?.items.map((item) => item.label)).toContain("Failed jobs");
    },
  );

  it.each<UserStaffRole>(["sales_manager", "client_services", "compliance"])(
    "is hidden from %s",
    (staffRole) => {
      const labels = groupsFor("staff", staffRole).flatMap((group) =>
        group.items.map((item) => item.label),
      );
      expect(labels).not.toContain("Failed jobs");
    },
  );

  it("points finance at the same page, which their roles narrow to Xero", () => {
    const item = groupsFor("staff", "finance")
      .flatMap((group) => group.items)
      .find((entry) => entry.label === "Failed jobs");
    expect(item?.href).toBe("/admin/failed-jobs");
  });

  it("is not offered to a customer", () => {
    const labels = groupsFor("client", null).flatMap((group) =>
      group.items.map((item) => item.label),
    );
    expect(labels).not.toContain("Failed jobs");
  });

  it("follows the audit log in Operations", () => {
    const operations = groupsFor("staff", "administrator").find(
      (group) => group.id === "operations",
    );
    const labels = operations?.items.map((item) => item.label) ?? [];
    expect(labels.indexOf("Failed jobs")).toBe(labels.indexOf("Audit log") + 1);
  });

  it("carries the count of jobs waiting for review as a badge, and none at zero", () => {
    const failedJobs = (count: number) =>
      getStaffNavGroups("staff", 0, ["administrator"], 0, {
        ...EMPTY_ADMIN_NAV_COUNTS,
        failedJobsNeedsReview: count,
      })
        .flatMap((group) => group.items)
        .find((entry) => entry.label === "Failed jobs");
    expect(failedJobs(7)).toMatchObject({ badge: 7, badgeTone: "warning" });
    expect(failedJobs(0)?.badge).toBeUndefined();
  });
});
