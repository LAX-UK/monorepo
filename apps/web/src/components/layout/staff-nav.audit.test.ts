import type { UserStaffRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import { getStaffNavGroups } from "./staff-nav";

function labelsFor(role: "staff" | "client", staffRole: UserStaffRole | null) {
  return getStaffNavGroups(role, 0, staffRole ? [staffRole] : []).flatMap((group) =>
    group.items.map((item) => item.label),
  );
}

describe("staff nav: Audit log", () => {
  it.each<UserStaffRole>(["super_admin", "staff_viewer", "finance_ops", "auction_manager"])(
    "is offered to %s",
    (staffRole) => {
      expect(labelsFor("staff", staffRole)).toContain("Audit log");
    },
  );

  it("is not offered to a customer", () => {
    expect(labelsFor("client", null)).not.toContain("Audit log");
  });
});
