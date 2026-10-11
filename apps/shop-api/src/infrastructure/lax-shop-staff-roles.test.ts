import { shopStaffRoleEnum } from "@auction/db/schema";
import { laxShopStaffRoles } from "@auction/types";
import { describe, expect, it } from "vitest";

describe("LAX Shop staff roles", () => {
  it("match the shop_staff_role enum so invitations only offer roles Shop can store", () => {
    expect([...laxShopStaffRoles]).toEqual(shopStaffRoleEnum.enumValues);
  });
});
