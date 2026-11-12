import { describe, expect, it } from "vitest";
import { shellRolePillLabel } from "./shell-role-pill-label";

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
