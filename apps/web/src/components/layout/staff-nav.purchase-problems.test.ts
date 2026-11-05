import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { PURCHASE_PROBLEMS_ACCESS, userHasAccessTo, userStaffRoles } from "@auction/types";
import { describe, expect, it } from "vitest";
import { getStaffNavGroups } from "./staff-nav";

function people(role: "staff" | "client", staffRole: (typeof userStaffRoles)[number] | null) {
  const groups = getStaffNavGroups(
    role,
    0,
    staffRole ? [staffRole] : [],
    0,
    EMPTY_ADMIN_NAV_COUNTS,
  );
  return groups.find((group) => group.id === "people");
}

const item = (group: ReturnType<typeof people>) =>
  group?.items.find((entry) => entry.label === "Purchase problems");

describe("staff nav: Purchase problems", () => {
  it.each(["administrator", "client_services"] as const)("is offered to %s in People", (role) => {
    expect(item(people("staff", role))?.href).toBe("/admin/purchase-problems");
  });

  it.each(userStaffRoles.filter((role) => !["administrator", "client_services"].includes(role)))(
    "is hidden from %s",
    (role) => {
      expect(item(people("staff", role))).toBeUndefined();
    },
  );

  it("is not offered to a customer", () => {
    expect(item(people("client", null))).toBeUndefined();
  });

  it("sits beside Enquiries, and is the same rule as the page's access requirement", () => {
    const labels = people("staff", "client_services")?.items.map((entry) => entry.label) ?? [];
    expect(labels.indexOf("Purchase problems")).toBe(labels.indexOf("Enquiries") + 1);
    expect(userHasAccessTo("staff", ["client_services"], PURCHASE_PROBLEMS_ACCESS)).toBe(true);
    expect(userHasAccessTo("staff", ["finance"], PURCHASE_PROBLEMS_ACCESS)).toBe(false);
  });

  it("stays selected on a record", () => {
    const entry = item(people("staff", "administrator"));
    expect(entry?.match?.("/admin/purchase-problems/abc")).toBe(true);
    expect(entry?.match?.("/admin/purchase-problems-archive")).toBe(false);
  });
});
