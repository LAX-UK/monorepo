import { describe, expect, it } from "vitest";
import { userStaffRoles } from "../user.js";
import {
  FORBIDDEN_STAFF_ROLE_COMBINATIONS,
  checkStaffRoleAssignment,
  isForbiddenStaffRoleCombination,
} from "./staff-role-assignment-rules.js";
import type { StaffRoleAssignment } from "./staff-role-assignment.js";

const NOW = new Date("2026-10-28T12:00:00Z");
const HOUR = 3_600_000;
const at = (offsetHours: number) => new Date(NOW.getTime() + offsetHours * HOUR);
const ROSTER = { otherActiveAdministrators: 1 };

function held(role: StaffRoleAssignment["role"], startsAt = at(-1), endsAt: Date | null = null) {
  return { role, startsAt, endsAt };
}

function assign(role: StaffRoleAssignment["role"], startsAt = NOW, endsAt: Date | null = null) {
  return { kind: "assign" as const, role, startsAt, endsAt };
}

describe("forbidden combinations", () => {
  it("keeps the administrator and read-only roles alone", () => {
    for (const other of userStaffRoles) {
      if (other !== "super_admin") {
        expect(isForbiddenStaffRoleCombination("super_admin", other)).toBe(true);
      }
      if (other !== "staff_viewer") {
        expect(isForbiddenStaffRoleCombination(other, "staff_viewer")).toBe(true);
      }
    }
  });

  it("separates finance and compliance in both directions", () => {
    expect(isForbiddenStaffRoleCombination("finance_ops", "compliance_officer")).toBe(true);
    expect(isForbiddenStaffRoleCombination("compliance_officer", "finance_ops")).toBe(true);
  });

  it("allows other pairs", () => {
    expect(isForbiddenStaffRoleCombination("specialist", "client_advisor")).toBe(false);
    expect(isForbiddenStaffRoleCombination("finance_ops", "auction_manager")).toBe(false);
  });

  it("explains every rule", () => {
    for (const rule of FORBIDDEN_STAFF_ROLE_COMBINATIONS)
      expect(rule.why.length).toBeGreaterThan(0);
  });
});

describe("checkStaffRoleAssignment: assign", () => {
  it("accepts a first role and a compatible second role", () => {
    expect(checkStaffRoleAssignment([], assign("specialist"), NOW, ROSTER)).toEqual({ ok: true });
    expect(
      checkStaffRoleAssignment([held("specialist")], assign("client_advisor"), NOW, ROSTER),
    ).toEqual({ ok: true });
  });

  it("refuses a role already held in the same period", () => {
    expect(
      checkStaffRoleAssignment([held("specialist")], assign("specialist"), NOW, ROSTER),
    ).toEqual({ ok: false, reason: "duplicate" });
  });

  it("allows the same role again once the earlier one has ended", () => {
    expect(
      checkStaffRoleAssignment(
        [held("specialist", at(-9), at(-1))],
        assign("specialist"),
        NOW,
        ROSTER,
      ),
    ).toEqual({ ok: true });
  });

  it("refuses a forbidden combination and names the role in the way", () => {
    expect(
      checkStaffRoleAssignment([held("finance_ops")], assign("compliance_officer"), NOW, ROSTER),
    ).toEqual({ ok: false, reason: "forbidden_combination", conflictingRole: "finance_ops" });
    expect(
      checkStaffRoleAssignment([held("super_admin")], assign("specialist"), NOW, ROSTER),
    ).toEqual({
      ok: false,
      reason: "forbidden_combination",
      conflictingRole: "super_admin",
    });
    expect(
      checkStaffRoleAssignment([held("specialist")], assign("staff_viewer"), NOW, ROSTER),
    ).toEqual({ ok: false, reason: "forbidden_combination", conflictingRole: "specialist" });
  });

  it("refuses a forbidden combination that only overlaps later", () => {
    expect(
      checkStaffRoleAssignment(
        [held("finance_ops", at(5), null)],
        assign("compliance_officer", NOW, at(10)),
        NOW,
        ROSTER,
      ),
    ).toMatchObject({ ok: false, reason: "forbidden_combination" });
  });

  it("allows a forbidden pair in periods that do not overlap", () => {
    expect(
      checkStaffRoleAssignment(
        [held("finance_ops", at(-1), at(2))],
        assign("compliance_officer", at(2), null),
        NOW,
        ROSTER,
      ),
    ).toEqual({ ok: true });
  });

  it("refuses a period that ends before it starts or is already over", () => {
    expect(checkStaffRoleAssignment([], assign("specialist", NOW, at(-1)), NOW, ROSTER)).toEqual({
      ok: false,
      reason: "invalid_period",
    });
    expect(checkStaffRoleAssignment([], assign("specialist", at(-5), at(-1)), NOW, ROSTER)).toEqual(
      { ok: false, reason: "invalid_period" },
    );
  });
});

describe("checkStaffRoleAssignment: remove", () => {
  const remove = (role: StaffRoleAssignment["role"]) => ({ kind: "remove" as const, role });

  it("removes a held role", () => {
    expect(
      checkStaffRoleAssignment([held("specialist")], remove("specialist"), NOW, ROSTER),
    ).toEqual({
      ok: true,
    });
  });

  it("refuses to remove a role the person does not hold", () => {
    expect(checkStaffRoleAssignment([], remove("specialist"), NOW, ROSTER)).toEqual({
      ok: false,
      reason: "not_assigned",
    });
    expect(
      checkStaffRoleAssignment(
        [held("specialist", at(-9), at(-1))],
        remove("specialist"),
        NOW,
        ROSTER,
      ),
    ).toEqual({ ok: false, reason: "not_assigned" });
  });

  it("never removes the last active administrator", () => {
    expect(
      checkStaffRoleAssignment([held("super_admin")], remove("super_admin"), NOW, {
        otherActiveAdministrators: 0,
      }),
    ).toEqual({ ok: false, reason: "last_administrator" });
    expect(
      checkStaffRoleAssignment([held("super_admin")], remove("super_admin"), NOW, {
        otherActiveAdministrators: 1,
      }),
    ).toEqual({ ok: true });
  });

  it("may withdraw an administrator role that has not started", () => {
    expect(
      checkStaffRoleAssignment([held("super_admin", at(3))], remove("super_admin"), NOW, {
        otherActiveAdministrators: 0,
      }),
    ).toEqual({ ok: true });
  });
});
