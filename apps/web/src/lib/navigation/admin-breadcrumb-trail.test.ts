import type { SessionUser } from "@/lib/data/contracts";
import { describe, expect, it } from "vitest";
import { buildAdminBreadcrumbTrail } from "./admin-breadcrumb-trail";

const sessionUser = {
  id: "u1",
  name: "Staff",
  email: "staff@example.com",
  role: "staff",
  staffRole: "super_admin",
} as SessionUser;

describe("buildAdminBreadcrumbTrail", () => {
  it("starts with Finance workspace for finance role", () => {
    const items = buildAdminBreadcrumbTrail("/admin/payments", "finance", sessionUser);
    expect(items[0]).toEqual({ label: "Finance", href: "/admin/finance" });
    expect(items.at(-1)?.label).toBeTruthy();
  });

  it("starts with Admin workspace for platform role", () => {
    const items = buildAdminBreadcrumbTrail("/admin/lots", "platform", sessionUser);
    expect(items[0]).toEqual({ label: "Admin", href: "/admin" });
  });

  it("includes current route label for nested paths", () => {
    const items = buildAdminBreadcrumbTrail("/admin/lots/abc", "platform", sessionUser);
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.at(-1)?.label).toBeTruthy();
  });

  it("builds trails for finance payments and platform saleroom", () => {
    const payments = buildAdminBreadcrumbTrail(
      "/admin/payments/manual-review",
      "finance",
      sessionUser,
    );
    expect(payments[0]?.href).toBe("/admin/finance");

    const saleroom = buildAdminBreadcrumbTrail("/admin/saleroom", "platform", sessionUser);
    expect(
      saleroom.some(
        (i) => i.label.toLowerCase().includes("saleroom") || i.href?.includes("saleroom"),
      ),
    ).toBe(true);
  });
});
