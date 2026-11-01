import type { UserStaffRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import { getStaffNavGroups } from "./staff-nav";

function groupsFor(role: "staff" | "client", staffRole: UserStaffRole | null) {
  return getStaffNavGroups(role, 0, staffRole ? [staffRole] : []);
}

describe("staff nav: Failed jobs", () => {
  it.each<UserStaffRole>(["administrator", "read_only"])("is offered to %s", (staffRole) => {
    const operations = groupsFor("staff", staffRole).find((group) => group.id === "operations");
    expect(operations?.items.map((item) => item.label)).toContain("Failed jobs");
  });

  it.each<UserStaffRole>(["finance", "sales_manager"])("is hidden from %s", (staffRole) => {
    const labels = groupsFor("staff", staffRole).flatMap((group) =>
      group.items.map((item) => item.label),
    );
    expect(labels).not.toContain("Failed jobs");
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
});
