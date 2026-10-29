import { describe, expect, it } from "vitest";
import { capabilitiesForRoles } from "./staff-capabilities.js";
import { LAX_ADMIN_ROLE_SUCCESSORS, planLaxAdminRoleMigration } from "./staff-role-migration.js";

const member = (role: string, subjectId = `s-${role}`) => ({
  subjectId,
  name: null,
  email: `${role}@example.com`,
  role,
});

describe("LAX Admin role migration plan", () => {
  it("maps every single role to the same role, and catalogue editors also to Editor", () => {
    expect(LAX_ADMIN_ROLE_SUCCESSORS).toEqual({
      shop_admin: ["shop_admin"],
      account_manager: ["account_manager"],
      broker: ["broker"],
      operations: ["operations"],
      finance: ["finance"],
      catalogue_editor: ["catalogue_editor", "editor"],
    });
  });

  it("loses nobody any capability", () => {
    const plan = planLaxAdminRoleMigration(
      Object.keys(LAX_ADMIN_ROLE_SUCCESSORS).map((r) => member(r)),
    );
    expect(plan.peopleWithLosses).toBe(0);
    for (const change of plan.changes) expect(change.lost).toEqual([]);
  });

  it("keeps a catalogue editor's editorial work through Editor, with nothing new", () => {
    const [change] = planLaxAdminRoleMigration([member("catalogue_editor")]).changes;
    expect(change?.rolesAfter).toEqual(["catalogue_editor", "editor"]);
    expect(change?.gained).toEqual([]);
    const after = capabilitiesForRoles(change?.rolesAfter ?? []);
    expect(after.has("editorial.publish")).toBe(true);
    expect(after.has("catalogue.write")).toBe(true);
  });

  it("flags a stored role it does not know as a loss, so the report stops", () => {
    const plan = planLaxAdminRoleMigration([member("gallery_manager")]);
    expect(plan.changes[0]?.unknownRole).toBe(true);
    expect(plan.peopleWithLosses).toBe(1);
  });
});
