import {
  canAccessFinanceAdminRoutes,
  canAccessPlatformAdminRoutes,
  normalizeUserRole,
  roleHasCapability,
  staffRoleDefaultDestination,
} from "@auction/types";
import type { UserStaffRole } from "@auction/types";
import { describe, expect, it } from "vitest";

describe("role policy (staff | client)", () => {
  it("normalizes legacy session roles to staff", () => {
    expect(normalizeUserRole("administrator")).toBe("staff");
    expect(normalizeUserRole("accountant")).toBe("staff");
    expect(normalizeUserRole("admin")).toBe("staff");
  });

  it("platform shell access excludes finance_ops only", () => {
    expect(canAccessPlatformAdminRoutes("staff", "super_admin")).toBe(true);
    expect(canAccessPlatformAdminRoutes("staff", "finance_ops")).toBe(false);
    expect(canAccessPlatformAdminRoutes("staff", "staff_viewer")).toBe(true);
    expect(canAccessPlatformAdminRoutes("client", null)).toBe(false);
    expect(canAccessPlatformAdminRoutes("staff", null)).toBe(false);
  });

  it("finance routes require finance.read capability", () => {
    expect(canAccessFinanceAdminRoutes("staff", "finance_ops")).toBe(true);
    expect(canAccessFinanceAdminRoutes("staff", "super_admin")).toBe(true);
    expect(canAccessFinanceAdminRoutes("staff", "staff_viewer")).toBe(false);
    expect(canAccessFinanceAdminRoutes("client", null)).toBe(false);
  });

  it("staff without staffRole has no capabilities", () => {
    expect(roleHasCapability("staff", "catalogue.write", null)).toBe(false);
    expect(roleHasCapability("staff", "platform.admin.full", null)).toBe(false);
  });

  it("client caps are limited", () => {
    expect(roleHasCapability("client", "bid.place", null)).toBe(true);
    expect(roleHasCapability("client", "client.submit", null)).toBe(true);
    expect(roleHasCapability("client", "catalogue.write", null)).toBe(false);
  });

  it("maps staff_role matrix for representative capabilities", () => {
    expect(roleHasCapability("staff", "platform.admin.full", "super_admin")).toBe(true);
    expect(roleHasCapability("staff", "auction.manage", "auction_manager")).toBe(true);
    expect(roleHasCapability("staff", "catalogue.write", "catalogue_manager")).toBe(true);
    expect(roleHasCapability("staff", "specialist.appraise", "specialist")).toBe(true);
    expect(roleHasCapability("staff", "finance.read", "finance_ops")).toBe(true);
    expect(roleHasCapability("staff", "operations.fulfilment", "operations_fulfilment")).toBe(true);
    expect(roleHasCapability("staff", "content.write", "content_marketing")).toBe(true);
    expect(roleHasCapability("staff", "support.respond", "support_concierge")).toBe(true);
    expect(roleHasCapability("staff", "legal_entity.read", "staff_viewer")).toBe(true);
    expect(roleHasCapability("staff", "artist.read", "staff_viewer")).toBe(true);
    expect(roleHasCapability("staff", "finance.read", "staff_viewer")).toBe(false);
  });

  it("staffRoleDefaultDestination", () => {
    expect(staffRoleDefaultDestination("staff", "super_admin")).toBe("/admin");
    expect(staffRoleDefaultDestination("staff", "finance_ops")).toBe("/admin/payments");
    expect(staffRoleDefaultDestination("staff", "auction_manager")).toBe("/admin/sales");
    expect(staffRoleDefaultDestination("staff", "catalogue_manager")).toBe("/admin/lots");
    expect(staffRoleDefaultDestination("staff", "specialist")).toBe("/admin/submissions");
    expect(staffRoleDefaultDestination("staff", "staff_viewer")).toBe("/admin/legal-entities");
    expect(staffRoleDefaultDestination("client", null)).toBe("/dashboard");
  });

  it("enumerates staff_role vs capability matrix (non–super_admin)", () => {
    const staffRoles: Exclude<UserStaffRole, "super_admin">[] = [
      "auction_manager",
      "catalogue_manager",
      "specialist",
      "finance_ops",
      "operations_fulfilment",
      "content_marketing",
      "support_concierge",
      "staff_viewer",
    ];
    const caps = [
      "platform.admin.full",
      "finance.read",
      "auction.manage",
      "catalogue.write",
      "specialist.appraise",
      "operations.fulfilment",
      "content.write",
      "support.respond",
      "legal_entity.read",
      "artist.read",
    ] as const;
    for (const sr of staffRoles) {
      for (const cap of caps) {
        roleHasCapability("staff", cap, sr);
      }
    }
  });
});
