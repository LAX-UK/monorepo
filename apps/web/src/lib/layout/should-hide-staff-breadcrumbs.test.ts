import { describe, expect, it } from "vitest";
import { shouldHideStaffBreadcrumbs } from "./should-hide-staff-breadcrumbs";

describe("shouldHideStaffBreadcrumbs", () => {
  it("hides shell breadcrumbs on catalog list and detail routes", () => {
    expect(shouldHideStaffBreadcrumbs("/admin/sales")).toBe(true);
    expect(shouldHideStaffBreadcrumbs("/admin/sales/sale-1/overview")).toBe(true);
    expect(shouldHideStaffBreadcrumbs("/admin/lots")).toBe(true);
    expect(shouldHideStaffBreadcrumbs("/admin/lots/lot-1/edit")).toBe(true);
    expect(shouldHideStaffBreadcrumbs("/admin/submissions")).toBe(true);
    expect(shouldHideStaffBreadcrumbs("/admin/artists/artist-1")).toBe(true);
    expect(shouldHideStaffBreadcrumbs("/admin/categories")).toBe(true);
    expect(shouldHideStaffBreadcrumbs("/admin/venues/venue-1")).toBe(true);
    expect(shouldHideStaffBreadcrumbs("/admin/condition-reports/cr-1")).toBe(true);
  });

  it("keeps shell breadcrumbs on non-catalog admin routes", () => {
    expect(shouldHideStaffBreadcrumbs("/admin")).toBe(false);
    expect(shouldHideStaffBreadcrumbs("/admin/finance")).toBe(false);
    expect(shouldHideStaffBreadcrumbs("/admin/settings")).toBe(false);
  });
});
