import { describe, expect, it } from "vitest";
import {
  SHOP_STAFF_CAPABILITIES,
  type ShopStaffCapability,
  type ShopStaffRole,
  capabilitiesForRole,
  roleHasCapability,
} from "./staff-capabilities.js";

const ROLES: ShopStaffRole[] = [
  "shop_admin",
  "account_manager",
  "broker",
  "operations",
  "finance",
  "catalogue_editor",
];

describe("staff capabilities matrix", () => {
  it.each(
    ROLES.flatMap((role) =>
      SHOP_STAFF_CAPABILITIES.map((capability) => [role, capability] as const),
    ),
  )("role %s capability %s", (role, capability) => {
    const allowed = capabilitiesForRole(role).includes(capability);
    expect(roleHasCapability(role, capability)).toBe(allowed);
  });

  it("brokers do not receive third_party_sale.write", () => {
    expect(roleHasCapability("broker", "third_party_sale.write")).toBe(false);
  });

  it("operations receive third_party_sale.write", () => {
    expect(roleHasCapability("operations", "third_party_sale.write")).toBe(true);
  });

  it("merchandise capabilities exist on shop_admin", () => {
    for (const cap of ["merchandise.read", "merchandise.write"] as ShopStaffCapability[]) {
      expect(roleHasCapability("shop_admin", cap)).toBe(true);
    }
  });

  it("stock_hold.override is limited to managers and admins", () => {
    expect(roleHasCapability("shop_admin", "stock_hold.override")).toBe(true);
    expect(roleHasCapability("account_manager", "stock_hold.override")).toBe(true);
    expect(roleHasCapability("broker", "stock_hold.override")).toBe(false);
    expect(roleHasCapability("operations", "stock_hold.override")).toBe(false);
  });
});
