import { type StaffNavGroup, resolveActiveItem } from "@auction/staff-ui";
import { describe, expect, it } from "vitest";
import { getStaffNavGroups } from "./staff-nav";

function activeHref(pathname: string, staffRoles: Parameters<typeof getStaffNavGroups>[2]) {
  const groups: StaffNavGroup[] = getStaffNavGroups("staff", 0, staffRoles).map((group) => ({
    id: group.id,
    items: group.items.map((item) => ({
      href: item.href,
      label: item.label,
      icon: item.icon,
      ...(item.match ? { match: item.match } : {}),
    })),
  }));
  return resolveActiveItem(pathname, groups)?.href ?? null;
}

describe("staff nav: the current page", () => {
  it("marks Access review on the access review, not Staff", () => {
    expect(activeHref("/admin/staff/access", ["administrator"])).toBe("/admin/staff/access");
    expect(activeHref("/admin/staff/access", ["read_only"])).toBe("/admin/staff/access");
  });

  it("keeps Staff for the directory and every staff record", () => {
    expect(activeHref("/admin/staff", ["administrator"])).toBe("/admin/staff");
    expect(activeHref("/admin/staff/user_123", ["administrator"])).toBe("/admin/staff");
  });
});
