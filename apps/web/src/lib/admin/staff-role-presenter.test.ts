import { describe, expect, it } from "vitest";
import { shellRolePillLabel, staffRoleLabel } from "./staff-role-presenter";

describe("staffRoleLabel", () => {
  it("maps curated labels for all staff roles", () => {
    expect(staffRoleLabel("operations")).toBe("Operations");
    expect(staffRoleLabel("finance_ops")).toBe("Finance");
    expect(staffRoleLabel("operations_fulfilment")).toBe("Operations fulfilment");
    expect(staffRoleLabel("content_marketing")).toBe("Content & marketing");
  });

  it("returns legacy label when staffRole is null", () => {
    expect(staffRoleLabel(null)).toBe("Default (legacy full)");
  });
});

describe("shellRolePillLabel", () => {
  it("returns Client for client users", () => {
    expect(shellRolePillLabel({ role: "client", staffRole: null })).toBe("Client");
  });

  it("returns exact staff role for platform staff", () => {
    expect(shellRolePillLabel({ role: "staff", staffRole: "catalogue_manager" })).toBe(
      "Catalogue manager",
    );
  });

  it("returns Finance for finance_ops", () => {
    expect(shellRolePillLabel({ role: "staff", staffRole: "finance_ops" })).toBe("Finance");
  });

  it("falls back to Staff when staffRole is missing", () => {
    expect(shellRolePillLabel({ role: "staff", staffRole: null })).toBe("Staff");
  });
});
