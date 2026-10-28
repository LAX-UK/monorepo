import {
  canAccessFinanceAdminRoutes,
  canAccessPlatformAdminRoutes,
  normalizeUserRole,
  roleHasCapability,
  staffRoleDefaultDestination,
  userStaffRoles,
} from "@auction/types";
import { describe, expect, it } from "vitest";

describe("role policy (staff | client)", () => {
  it("normalizes legacy session roles to staff", () => {
    expect(normalizeUserRole("administrator")).toBe("staff");
    expect(normalizeUserRole("accountant")).toBe("staff");
    expect(normalizeUserRole("admin")).toBe("staff");
  });

  it("platform shell access excludes finance only", () => {
    expect(canAccessPlatformAdminRoutes("staff", ["administrator"])).toBe(true);
    expect(canAccessPlatformAdminRoutes("staff", ["finance"])).toBe(false);
    expect(canAccessPlatformAdminRoutes("staff", ["read_only"])).toBe(true);
    expect(canAccessPlatformAdminRoutes("client", [])).toBe(false);
    expect(canAccessPlatformAdminRoutes("staff", [])).toBe(false);
  });

  it("finance routes require finance.read capability", () => {
    expect(canAccessFinanceAdminRoutes("staff", ["finance"])).toBe(true);
    expect(canAccessFinanceAdminRoutes("staff", ["administrator"])).toBe(true);
    expect(canAccessFinanceAdminRoutes("staff", ["read_only"])).toBe(false);
    expect(canAccessFinanceAdminRoutes("client", [])).toBe(false);
  });

  it("staff without staffRoles has no capabilities", () => {
    expect(roleHasCapability("staff", "catalogue.write", [])).toBe(false);
    expect(roleHasCapability("staff", "platform.admin.full", [])).toBe(false);
  });

  it("client caps are limited", () => {
    expect(roleHasCapability("client", "bid.place", [])).toBe(true);
    expect(roleHasCapability("client", "client.submit", [])).toBe(true);
    expect(roleHasCapability("client", "catalogue.write", [])).toBe(false);
  });

  it("maps staff_role matrix for representative capabilities", () => {
    expect(roleHasCapability("staff", "platform.admin.full", ["administrator"])).toBe(true);
    expect(roleHasCapability("staff", "auction.manage", ["sales_manager"])).toBe(true);
    expect(roleHasCapability("staff", "saleroom.operate", ["saleroom_clerk"])).toBe(true);
    expect(roleHasCapability("staff", "auction.manage", ["saleroom_clerk"])).toBe(false);
    expect(roleHasCapability("staff", "catalogue.write", ["cataloguer"])).toBe(true);
    expect(roleHasCapability("staff", "specialist.appraise", ["specialist"])).toBe(true);
    expect(roleHasCapability("staff", "finance.read", ["finance"])).toBe(true);
    expect(roleHasCapability("staff", "operations.fulfilment", ["fulfilment"])).toBe(true);
    expect(roleHasCapability("staff", "admin.read", ["read_only"])).toBe(true);
    expect(roleHasCapability("staff", "support.respond", ["client_services"])).toBe(true);
    expect(roleHasCapability("staff", "legal_entity.read", ["read_only"])).toBe(true);
    expect(roleHasCapability("staff", "artist.read", ["read_only"])).toBe(true);
    expect(roleHasCapability("staff", "finance.read", ["read_only"])).toBe(false);
    expect(roleHasCapability("staff", "client.read", ["client_services"])).toBe(true);
    expect(roleHasCapability("staff", "bids.read", ["client_services"])).toBe(true);
    expect(roleHasCapability("staff", "aml.review", ["compliance"])).toBe(true);
  });

  it("staffRoleDefaultDestination", () => {
    expect(staffRoleDefaultDestination("staff", ["administrator"])).toBe("/admin");
    expect(staffRoleDefaultDestination("staff", ["finance"])).toBe("/admin/finance");
    expect(staffRoleDefaultDestination("staff", ["sales_manager"])).toBe("/admin/sales");
    expect(staffRoleDefaultDestination("staff", ["saleroom_clerk"])).toBe("/admin/saleroom");
    expect(staffRoleDefaultDestination("staff", ["cataloguer"])).toBe("/admin/lots");
    expect(staffRoleDefaultDestination("staff", ["specialist"])).toBe("/admin/submissions");
    expect(staffRoleDefaultDestination("staff", ["read_only"])).toBe("/admin/legal-entities");
    expect(staffRoleDefaultDestination("staff", ["client_services"])).toBe("/admin/clients");
    expect(
      staffRoleDefaultDestination("staff", [
        "sales_manager",
        "cataloguer",
        "client_services",
        "fulfilment",
      ]),
    ).toBe("/admin/sales");
    expect(staffRoleDefaultDestination("staff", [])).toBe("/admin");
    expect(staffRoleDefaultDestination("client", [])).toBe("/home");
  });

  it("staffRoleDefaultDestination never returns /home for staff", () => {
    for (const sr of [...userStaffRoles, null]) {
      expect(staffRoleDefaultDestination("staff", sr ? [sr] : [])).not.toBe("/home");
    }
  });
});
