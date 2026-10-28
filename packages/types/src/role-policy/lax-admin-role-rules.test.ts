import { describe, expect, it } from "vitest";
import { type LaxShopStaffRole, laxShopStaffRoles } from "../lax-staff-platforms.js";
import { staffRoleRefusalMessage } from "../staff-role-refusal.js";
import {
  FORBIDDEN_LAX_ADMIN_ROLE_COMBINATIONS,
  LAX_ADMIN_ROLE_RULES,
  activeLaxAdminRoles,
  laxAdminRolesFromGrants,
  normalizeLaxAdminRoles,
  primaryLaxAdminRole,
} from "./lax-admin-role-rules.js";
import { BID_STAFF_ROLE_RULES } from "./staff-role-assignment-rules.js";

const NOW = new Date("2026-10-29T12:00:00Z");
const HOUR = 3_600_000;
const at = (offsetHours: number) => new Date(NOW.getTime() + offsetHours * HOUR);

function held(role: LaxShopStaffRole, startsAt = at(-1), endsAt: Date | null = null) {
  return { role, startsAt, endsAt };
}

function assign(role: LaxShopStaffRole, endsAt: Date | null = null) {
  return { kind: "assign" as const, role, startsAt: NOW, endsAt };
}

const rules = LAX_ADMIN_ROLE_RULES;

describe("LAX Admin forbidden combinations", () => {
  it("keeps the Administrator and Read-only roles alone", () => {
    for (const other of laxShopStaffRoles) {
      if (other !== "shop_admin")
        expect(rules.isForbiddenCombination("shop_admin", other)).toBe(true);
      if (other !== "read_only")
        expect(rules.isForbiddenCombination(other, "read_only")).toBe(true);
    }
  });

  it("separates Finance from Account manager and Broker, both ways", () => {
    for (const other of ["account_manager", "broker"] as const) {
      expect(rules.isForbiddenCombination("finance", other)).toBe(true);
      expect(rules.isForbiddenCombination(other, "finance")).toBe(true);
    }
  });

  it("allows the other pairs, including Catalogue editor with Editor", () => {
    expect(rules.isForbiddenCombination("catalogue_editor", "editor")).toBe(false);
    expect(rules.isForbiddenCombination("finance", "operations")).toBe(false);
    expect(rules.isForbiddenCombination("account_manager", "broker")).toBe(false);
  });

  it("explains every rule", () => {
    for (const rule of FORBIDDEN_LAX_ADMIN_ROLE_COMBINATIONS) expect(rule.why).not.toBe("");
  });

  it("keeps the two admins' tables apart", () => {
    expect(BID_STAFF_ROLE_RULES.table.administratorRole).toBe("administrator");
    expect(rules.table.administratorRole).toBe("shop_admin");
    expect(BID_STAFF_ROLE_RULES.isForbiddenCombination("finance", "client_services")).toBe(false);
  });
});

describe("LAX Admin role changes", () => {
  const roster = { otherActiveAdministrators: 1 };

  it("refuses a forbidden combination and names the role held", () => {
    expect(rules.check([held("broker")], assign("finance"), NOW, roster)).toEqual({
      ok: false,
      reason: "forbidden_combination",
      conflictingRole: "broker",
    });
  });

  it("allows a forbidden role once the other has ended", () => {
    expect(rules.check([held("broker", at(-10), at(-1))], assign("finance"), NOW, roster)).toEqual({
      ok: true,
    });
  });

  it("refuses a role held twice and an end date in the past", () => {
    expect(rules.check([held("editor")], assign("editor"), NOW, roster)).toMatchObject({
      reason: "duplicate",
    });
    expect(rules.check([], assign("editor", at(-1)), NOW, roster)).toMatchObject({
      reason: "invalid_period",
    });
  });

  it("never removes the last Administrator", () => {
    expect(
      rules.check([held("shop_admin")], { kind: "remove", role: "shop_admin" }, NOW, {
        otherActiveAdministrators: 0,
      }),
    ).toEqual({ ok: false, reason: "last_administrator" });
    expect(
      rules.check([held("shop_admin")], { kind: "remove", role: "shop_admin" }, NOW, roster),
    ).toEqual({ ok: true });
  });

  it("checks an invitation's roles as a set", () => {
    expect(rules.checkSet(["catalogue_editor", "editor"])).toEqual({ ok: true });
    expect(rules.checkSet(["account_manager", "finance"])).toEqual({
      ok: false,
      reason: "forbidden_combination",
      role: "finance",
      conflictingRole: "account_manager",
    });
  });

  it("explains a refusal with LAX Admin's role names", () => {
    expect(
      staffRoleRefusalMessage({
        product: "shop",
        reason: "forbidden_combination",
        role: "finance",
        conflictingRole: "broker",
      }),
    ).toBe(
      "Finance can't be combined with Broker. Moving money and selling to clients are kept with different people.",
    );
  });
});

describe("LAX Admin role sets", () => {
  it("unions only the roles in force", () => {
    expect(
      activeLaxAdminRoles(
        [
          held("editor"),
          held("catalogue_editor"),
          held("finance", at(-5), at(-1)),
          held("broker", at(2)),
        ],
        NOW,
      ),
    ).toEqual(["catalogue_editor", "editor"]);
  });

  it("orders, de-duplicates and drops unknown roles", () => {
    expect(normalizeLaxAdminRoles(["editor", "x", "shop_admin", "editor", null])).toEqual([
      "shop_admin",
      "editor",
    ]);
    expect(primaryLaxAdminRole(["editor", "catalogue_editor"])).toBe("catalogue_editor");
    expect(primaryLaxAdminRole([])).toBeNull();
  });

  it("reads the LAX Admin roles of an invitation's grants", () => {
    expect(
      laxAdminRolesFromGrants([
        { product: "bid", role: "finance" },
        { product: "shop", role: "editor" },
        { product: "shop", role: "operations" },
      ]),
    ).toEqual(["operations", "editor"]);
  });
});
