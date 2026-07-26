import {
  invitationRoleLabel,
  platformRolePaletteKeys,
  resolvePlatformRolePresentation,
  staffRoleLabel,
} from "@/lib/presenters/platform-role/platform-role-registry";
import { userStaffRoles } from "@auction/types";
import { describe, expect, it } from "vitest";

describe("platform-role-registry", () => {
  it("covers every staff role with a unique palette", () => {
    const palettes = userStaffRoles.map(
      (role) => resolvePlatformRolePresentation("staff", role).paletteKey,
    );
    expect(new Set(palettes).size).toBe(userStaffRoles.length);
  });

  it("assigns a unique palette key for every platform role case", () => {
    expect(new Set(platformRolePaletteKeys).size).toBe(platformRolePaletteKeys.length);
    expect(platformRolePaletteKeys).toHaveLength(14);
  });

  it("resolves client presentation", () => {
    expect(resolvePlatformRolePresentation("client", null)).toMatchObject({
      label: "Client",
      paletteKey: "client",
    });
  });

  it("resolves legacy staff presentation", () => {
    expect(resolvePlatformRolePresentation("staff", null)).toMatchObject({
      label: "Staff",
      paletteKey: "staff_legacy",
    });
  });

  it("preserves invitationRoleLabel compatibility", () => {
    expect(invitationRoleLabel("client", null)).toBe("Client");
    expect(invitationRoleLabel("staff", "catalogue_manager")).toBe("Staff – Catalogue manager");
    expect(invitationRoleLabel("staff", null)).toBe("Staff – Default (legacy full)");
  });

  it("maps staffRoleLabel for all roles", () => {
    expect(staffRoleLabel("finance_ops")).toBe("Finance");
    expect(staffRoleLabel(null)).toBe("Default (legacy full)");
  });
});
