import {
  type AdminNavCounts,
  EMPTY_ADMIN_NAV_COUNTS,
} from "@/lib/data/http/admin-nav-counts.types";
import { userStaffRoles } from "@auction/types";
import { describe, expect, it } from "vitest";
import { getStaffNavGroups } from "./staff-nav";

function operations(
  staffRole: (typeof userStaffRoles)[number],
  counts: Partial<AdminNavCounts> = {},
) {
  return getStaffNavGroups("staff", 0, [staffRole], 0, {
    ...EMPTY_ADMIN_NAV_COUNTS,
    ...counts,
  }).find((group) => group.id === "operations");
}

const item = (group: ReturnType<typeof operations>) =>
  group?.items.find((entry) => entry.label === "Deliveries");

describe("staff nav: Deliveries", () => {
  it.each(["fulfilment", "administrator", "read_only"] as const)(
    "is offered to %s in Operations, beside Lot fulfilment",
    (role) => {
      const group = operations(role);
      expect(item(group)?.href).toBe("/admin/deliveries");
      const labels = group?.items.map((entry) => entry.label) ?? [];
      expect(labels.indexOf("Deliveries")).toBe(labels.indexOf("Lot fulfilment") + 1);
    },
  );

  it.each(
    userStaffRoles.filter((role) => !["fulfilment", "administrator", "read_only"].includes(role)),
  )("is hidden from %s", (role) => {
    expect(item(operations(role))).toBeUndefined();
  });

  it("counts buyers waiting for a price, and shows nothing when none are", () => {
    expect(item(operations("fulfilment"))?.badge).toBeUndefined();
    expect(item(operations("fulfilment", { deliveriesWaiting: 3 }))).toMatchObject({
      badge: 3,
      badgeTone: "warning",
    });
  });

  it("stays selected with a panel open", () => {
    expect(item(operations("fulfilment"))?.match?.("/admin/deliveries")).toBe(true);
  });
});
