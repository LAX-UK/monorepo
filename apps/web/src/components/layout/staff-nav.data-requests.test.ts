import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { DATA_REQUESTS_MANAGE_ACCESS, userHasAccessTo, userStaffRoles } from "@auction/types";
import { describe, expect, it } from "vitest";
import { getStaffNavGroups } from "./staff-nav";

function compliance(
  role: "staff" | "client",
  staffRole: (typeof userStaffRoles)[number] | null,
  counts = {},
) {
  const groups = getStaffNavGroups(role, 0, staffRole ? [staffRole] : [], 0, {
    ...EMPTY_ADMIN_NAV_COUNTS,
    ...counts,
  });
  return groups.find((group) => group.id === "compliance");
}

const item = (group: ReturnType<typeof compliance>) =>
  group?.items.find((entry) => entry.label === "Data requests");

describe("staff nav: Data requests", () => {
  it("is offered to Compliance and Administrator, in the Compliance group after Source of Funds", () => {
    for (const role of ["compliance", "administrator"] as const) {
      const group = compliance("staff", role);
      expect(item(group)?.href).toBe("/admin/compliance/data-requests");
      const labels = group?.items.map((entry) => entry.label) ?? [];
      expect(labels.indexOf("Data requests")).toBe(labels.indexOf("Source of Funds") + 1);
    }
  });

  it.each(userStaffRoles.filter((role) => role !== "compliance" && role !== "administrator"))(
    "is hidden from %s, Read-only included",
    (role) => {
      expect(item(compliance("staff", role))).toBeUndefined();
    },
  );

  it("is not offered to a customer", () => {
    expect(item(compliance("client", null))).toBeUndefined();
  });

  it("is the same rule as the page's access requirement", () => {
    expect(userHasAccessTo("staff", ["compliance"], DATA_REQUESTS_MANAGE_ACCESS)).toBe(true);
    expect(userHasAccessTo("staff", ["read_only"], DATA_REQUESTS_MANAGE_ACCESS)).toBe(false);
  });

  it("shows no count when no request is close", () => {
    expect(item(compliance("staff", "compliance"))?.badge).toBeUndefined();
  });

  it("shows a warning count for requests due soon", () => {
    const entry = item(compliance("staff", "compliance", { dataRequestsDueSoon: 2 }));
    expect(entry).toMatchObject({ badge: 2, badgeTone: "warning" });
  });

  it("shows a danger count once one is overdue, adding both", () => {
    const entry = item(
      compliance("staff", "compliance", { dataRequestsDueSoon: 1, dataRequestsOverdue: 1 }),
    );
    expect(entry).toMatchObject({ badge: 2, badgeTone: "danger" });
  });
});
