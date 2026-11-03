import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { ENQUIRIES_ACCESS, userHasAccessTo, userStaffRoles } from "@auction/types";
import { describe, expect, it } from "vitest";
import { getStaffNavGroups } from "./staff-nav";

function people(
  role: "staff" | "client",
  staffRole: (typeof userStaffRoles)[number] | null,
  counts = {},
) {
  const groups = getStaffNavGroups(role, 0, staffRole ? [staffRole] : [], 0, {
    ...EMPTY_ADMIN_NAV_COUNTS,
    ...counts,
  });
  return groups.find((group) => group.id === "people");
}

const item = (group: ReturnType<typeof people>) =>
  group?.items.find((entry) => entry.label === "Enquiries");

describe("staff nav: Enquiries", () => {
  it.each(["administrator", "sales_manager", "specialist", "client_services"] as const)(
    "is offered to %s in People",
    (role) => {
      expect(item(people("staff", role))?.href).toBe("/admin/enquiries");
    },
  );

  it.each(
    userStaffRoles.filter(
      (role) => !["administrator", "sales_manager", "specialist", "client_services"].includes(role),
    ),
  )("is hidden from %s, Read-only included", (role) => {
    expect(item(people("staff", role))).toBeUndefined();
  });

  it("is not offered to a customer", () => {
    expect(item(people("client", null))).toBeUndefined();
  });

  it("is the same rule as the page's access requirement", () => {
    expect(userHasAccessTo("staff", ["specialist"], ENQUIRIES_ACCESS)).toBe(true);
    expect(userHasAccessTo("staff", ["read_only"], ENQUIRIES_ACCESS)).toBe(false);
  });

  it("shows no count when nothing is waiting", () => {
    expect(item(people("staff", "specialist"))?.badge).toBeUndefined();
  });

  it("counts what is waiting, and warns once one is past its reply time", () => {
    expect(item(people("staff", "specialist", { enquiriesWaiting: 3 }))).toMatchObject({
      badge: 3,
      badgeTone: "default",
    });
    expect(
      item(people("staff", "specialist", { enquiriesWaiting: 3, enquiriesLate: 1 })),
    ).toMatchObject({ badge: 3, badgeTone: "warning" });
  });

  it("stays selected on a record", () => {
    const entry = item(people("staff", "specialist"));
    expect(entry?.match?.("/admin/enquiries/E-1042")).toBe(true);
    expect(entry?.match?.("/admin/enquiries-archive")).toBe(false);
  });
});
