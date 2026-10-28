import { describe, expect, it } from "vitest";
import { shellRolePillLabel, staffRoleLabel } from "./staff-role-presenter";

describe("staffRoleLabel", () => {
  it("maps curated labels for all staff roles", () => {
    expect(staffRoleLabel("administrator")).toBe("Administrator");
    expect(staffRoleLabel("sales_manager")).toBe("Sales manager");
    expect(staffRoleLabel("saleroom_clerk")).toBe("Saleroom clerk");
    expect(staffRoleLabel("client_services")).toBe("Client services");
    expect(staffRoleLabel("finance")).toBe("Finance");
    expect(staffRoleLabel("fulfilment")).toBe("Fulfilment");
    expect(staffRoleLabel("read_only")).toBe("Read-only");
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
    expect(shellRolePillLabel({ role: "staff", staffRole: "cataloguer" })).toBe("Cataloguer");
  });

  it("returns Finance for finance", () => {
    expect(shellRolePillLabel({ role: "staff", staffRole: "finance" })).toBe("Finance");
  });

  it("falls back to Staff when staffRole is missing", () => {
    expect(shellRolePillLabel({ role: "staff", staffRole: null })).toBe("Staff");
  });
});
