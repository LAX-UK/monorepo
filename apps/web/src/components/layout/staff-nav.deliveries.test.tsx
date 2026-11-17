import { toStaffNav } from "@/components/shell/bid-staff-frame";
import {
  type AdminNavCounts,
  EMPTY_ADMIN_NAV_COUNTS,
} from "@/lib/data/http/admin-nav-counts.types";
import { SidebarNav, StaffTooltipProvider } from "@auction/staff-ui";
import { userStaffRoles } from "@auction/types";
import { render, screen, within } from "@testing-library/react";
import Link from "next/link";
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
  // D5: exactly the roles that can open Lot fulfilment.
  it.each(["fulfilment", "administrator"] as const)(
    "is offered to %s in Operations, beside Lot fulfilment",
    (role) => {
      const group = operations(role);
      expect(item(group)?.href).toBe("/admin/deliveries");
      const labels = group?.items.map((entry) => entry.label) ?? [];
      expect(labels.indexOf("Deliveries")).toBe(labels.indexOf("Lot fulfilment") + 1);
    },
  );

  it.each(userStaffRoles.filter((role) => !["fulfilment", "administrator"].includes(role)))(
    "is hidden from %s",
    (role) => {
      expect(item(operations(role))).toBeUndefined();
    },
  );

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

  it('is read ", 3 waiting" by screen readers (D2, NAV-3)', () => {
    render(
      <StaffTooltipProvider>
        <SidebarNav
          groups={toStaffNav({ role: "staff", staffRoles: ["fulfilment"] }, 0, 0, {
            ...EMPTY_ADMIN_NAV_COUNTS,
            deliveriesWaiting: 3,
          })}
          pathname="/admin"
          Link={Link}
        />
      </StaffTooltipProvider>,
    );
    const nav = screen.getByRole("navigation", { name: "Main" });
    // The test runtime puts a space between the label's span and the count's; a browser reads
    // "Deliveries, 3 waiting".
    const link = within(nav).getByRole("link", { name: /^Deliveries\s?, 3 waiting$/ });
    expect(link).toHaveAttribute("href", "/admin/deliveries");
    // The pill shows the number; the words are for screen readers only.
    expect(within(link).getByText(", 3 waiting")).toHaveClass("sr-only");
  });
});
