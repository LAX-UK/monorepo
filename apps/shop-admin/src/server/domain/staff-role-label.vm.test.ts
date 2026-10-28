import { describe, expect, it } from "vitest";
import { staffRoleLabel, staffRolesLabel } from "./staff-role-label.vm";

describe("staffRoleLabel", () => {
  it("names each LAX Admin role in sentence case", () => {
    expect(staffRoleLabel("account_manager")).toBe("Account manager");
    expect(staffRoleLabel("shop_admin")).toBe("Administrator");
    expect(staffRoleLabel("read_only")).toBe("Read-only");
    expect(staffRoleLabel("some_future_role")).toBe("Some future role");
  });

  it("joins several roles in role order", () => {
    expect(staffRolesLabel(["editor", "catalogue_editor"])).toBe("Catalogue editor, Editor");
    expect(staffRolesLabel([])).toBe("");
  });
});
