import { describe, expect, it } from "vitest";
import { staffRoleLabel } from "./staff-role-label.vm";

describe("staffRoleLabel", () => {
  it("turns a role id into a sentence-case label", () => {
    expect(staffRoleLabel("account_manager")).toBe("Account manager");
    expect(staffRoleLabel("shop_admin")).toBe("Shop admin");
  });
});
