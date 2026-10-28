import {
  LOTS_ACCESS,
  SALEROOM_ACCESS,
  SALES_ACCESS,
  SALES_READ_ACCESS,
  USER_ROLE_MANAGEMENT_ACCESS,
} from "@auction/types";
import { describe, expect, it } from "vitest";
import { bidStaffAccess } from "./bid-staff-access";
import { staffRolesLabel } from "./staff-role-presenter";

describe("bidStaffAccess", () => {
  it("lets read-only staff open records but take no action", () => {
    const access = bidStaffAccess("staff", ["read_only"]);
    expect(access.can(SALES_READ_ACCESS)).toBe(true);
    expect(access.can(SALES_ACCESS)).toBe(false);
    expect(access.can(LOTS_ACCESS)).toBe(false);
    expect(access.can(SALEROOM_ACCESS)).toBe(false);
    expect(access.roleLabel).toBe("Read-only");
  });

  it("lets a saleroom clerk run the saleroom without editing sales", () => {
    const access = bidStaffAccess("staff", ["saleroom_clerk"]);
    expect(access.can(SALEROOM_ACCESS)).toBe(true);
    expect(access.can(SALES_ACCESS)).toBe(false);
  });

  it("adds up the permissions of every role held", () => {
    const access = bidStaffAccess("staff", ["saleroom_clerk", "sales_manager"]);
    expect(access.can(SALES_ACCESS)).toBe(true);
    expect(access.roleLabel).toBe("Sales manager and Saleroom clerk");
  });

  it("refuses a permission Bid does not know, and everything for a client", () => {
    expect(bidStaffAccess("staff", ["administrator"]).can("shop.refund")).toBe(false);
    expect(
      bidStaffAccess("staff", ["administrator"]).can({ anyOf: ["auction.manage", "shop.x"] }),
    ).toBe(false);
    expect(bidStaffAccess("client", []).can(USER_ROLE_MANAGEMENT_ACCESS)).toBe(false);
  });
});

describe("staffRolesLabel", () => {
  it("names every role, or says there is none", () => {
    expect(staffRolesLabel(["fulfilment", "cataloguer"])).toBe("Cataloguer and Fulfilment");
    expect(staffRolesLabel([])).toBe("No staff role");
  });
});
