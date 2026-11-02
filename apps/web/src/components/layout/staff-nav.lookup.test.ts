import { describe, expect, it } from "vitest";
import { findStaffNavItemForPath } from "./staff-nav";

describe("findStaffNavItemForPath", () => {
  it("returns the item for an exact nav path", () => {
    expect(findStaffNavItemForPath("/admin")?.href).toBe("/admin");
    expect(findStaffNavItemForPath("/admin/staff")?.href).toBe("/admin/staff");
  });

  it("resolves a detail route to its parent section by the longest prefix", () => {
    expect(findStaffNavItemForPath("/admin/staff/user_123")?.href).toBe("/admin/staff");
    expect(findStaffNavItemForPath("/admin/staff/access/extra")?.href).toBe("/admin/staff/access");
    expect(findStaffNavItemForPath("/admin/staff/user_123?tab=roles#top")?.href).toBe(
      "/admin/staff",
    );
  });

  it("never falls back to the Dashboard for a route with no nav parent", () => {
    expect(findStaffNavItemForPath("/admin/no-such-section/42")).toBeNull();
    expect(findStaffNavItemForPath("/admin/no-such-section/42")?.label).not.toBe("Dashboard");
  });
});
