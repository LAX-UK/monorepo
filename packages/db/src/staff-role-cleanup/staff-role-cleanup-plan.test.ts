import { readFileSync } from "node:fs";
import { join } from "node:path";
import { userStaffRoles } from "@auction/types";
import { describe, expect, it } from "vitest";
import { LEGACY_STAFF_ROLES, STAFF_ROLE_SUCCESSORS } from "./legacy-staff-roles.js";
import { planStaffMemberCleanup, planStaffRoleCleanup } from "./staff-role-cleanup-plan.js";
import { formatStaffRoleCleanupReport } from "./staff-role-cleanup-report.js";

const member = (roles: string[], id = "u1") => ({
  userId: id,
  name: `Person ${id}`,
  email: `${id}@lax.test`,
  roles,
});

describe("staff role clean-up plan", () => {
  it.each(LEGACY_STAFF_ROLES)("%s: nobody loses a permission", (role) => {
    expect(planStaffMemberCleanup(member([role])).lost).toEqual([]);
  });

  it("renames one-to-one roles without changing access", () => {
    for (const role of [
      "auction_manager",
      "catalogue_manager",
      "specialist",
      "finance_ops",
      "operations_fulfilment",
      "compliance_officer",
    ] as const) {
      const change = planStaffMemberCleanup(member([role]));
      expect(change.rolesAfter).toEqual(STAFF_ROLE_SUCCESSORS[role]);
      expect(change.gained).toEqual([]);
    }
  });

  it("gives the administrator the two new permissions", () => {
    expect(planStaffMemberCleanup(member(["super_admin"])).gained).toEqual([
      "admin.read",
      "saleroom.operate",
    ]);
  });

  it("splits Operations into four roles and lists what they add", () => {
    const change = planStaffMemberCleanup(member(["operations"]));
    expect(change.rolesAfter).toEqual([
      "sales_manager",
      "cataloguer",
      "client_services",
      "fulfilment",
    ]);
    expect(change.gained).toEqual([
      "artist.delete",
      "artist.review",
      "bids.read",
      "legal_entity.write",
      "support.respond",
    ]);
  });

  it("merges support concierge and client advisor into client services", () => {
    expect(planStaffMemberCleanup(member(["support_concierge"])).gained).toEqual([
      "bids.read",
      "client.read",
    ]);
    expect(planStaffMemberCleanup(member(["client_advisor"])).gained).toEqual(["support.respond"]);
    expect(planStaffMemberCleanup(member(["client_advisor", "support_concierge"]))).toMatchObject({
      rolesAfter: ["client_services"],
      gained: [],
      lost: [],
    });
  });

  it("moves content marketing to read-only: the email log opens with admin.read", () => {
    const change = planStaffMemberCleanup(member(["content_marketing"]));
    expect(change.rolesAfter).toEqual(["read_only"]);
    expect(change.gained).toEqual(["admin.read", "legal_entity.read"]);
    expect(change.lost).toEqual([]);
  });

  it("treats current role names as already moved", () => {
    expect(planStaffMemberCleanup(member(["finance", "read_only"]))).toMatchObject({
      rolesAfter: ["finance", "read_only"],
      gained: [],
      lost: [],
    });
  });

  it("reports stored roles it does not know", () => {
    const change = planStaffMemberCleanup(member(["mystery"]));
    expect(change.unknownRoles).toEqual(["mystery"]);
    expect(change.rolesAfter).toEqual([]);
  });

  it("counts the people who gain and lose", () => {
    const plan = planStaffRoleCleanup([
      member(["auction_manager"], "a"),
      member(["operations"], "b"),
      member(["staff_viewer"], "c"),
    ]);
    expect(plan.peopleWithGains).toBe(2);
    expect(plan.peopleWithLosses).toBe(0);
  });

  it("writes a report that flags every gain", () => {
    const report = formatStaffRoleCleanupReport({
      environment: "fixtures",
      generatedAt: new Date("2026-10-28T12:00:00Z"),
      plan: planStaffRoleCleanup([member(["operations"], "b"), member(["finance_ops"], "f")]),
      invitations: [{ email: "new@lax.test", role: "operations" }],
      organisationRoles: [
        { kind: "membership", organisation: "Gallery", person: "s@lax.test", role: "specialist" },
      ],
    });
    expect(report).toContain("- People who gain permissions: 1");
    expect(report).toContain("- People who lose permissions: 0");
    expect(report).toContain("| membership | Gallery | s@lax.test | specialist |");
    expect(report).toContain(
      "| Person b, b@lax.test | Operations | Sales manager, Cataloguer, Client services, Fulfilment | **Gains:** `artist.delete`",
    );
    expect(report).toContain("| Person f, f@lax.test | Finance | Finance | None | None |");
    expect(report).toContain(
      "| new@lax.test | Operations | Sales manager | An invitation carries one role: add Cataloguer, Client services, Fulfilment after acceptance. |",
    );
  });
});

describe("migration 0242 role map", () => {
  const drizzle = join(import.meta.dirname, "../../drizzle");
  const rows = (file: string, table: string) => {
    const sql = readFileSync(join(drizzle, file), "utf8");
    const block = sql.slice(
      sql.indexOf(`INSERT INTO "${table}"`),
      sql.indexOf(";", sql.indexOf(`INSERT INTO "${table}"`)),
    );
    return [...block.matchAll(/\('([a-z_]+)', '([a-z_]+)'(?:, (\d+))?\)/g)].map((m) => m.slice(1));
  };

  it("maps every previous role exactly as the report does", () => {
    const fromSql = new Map<string, string[]>();
    for (const [oldRole = "", newRole = "", position = ""] of rows(
      "0242_staff_role_cleanup.sql",
      "staff_role_cleanup_map",
    )) {
      const list = fromSql.get(oldRole) ?? [];
      list[Number(position) - 1] = newRole;
      fromSql.set(oldRole, list);
    }
    expect(Object.fromEntries(fromSql)).toEqual(
      Object.fromEntries(Object.entries(STAFF_ROLE_SUCCESSORS).map(([k, v]) => [k, [...v]])),
    );
  });

  it("rolls every current role back to a previous one", () => {
    const back = rows("0242_rollback.sql", "staff_role_rollback_map");
    expect(back.map(([newRole]) => newRole).sort()).toEqual([...userStaffRoles].sort());
    for (const [, oldRole] of back) expect(LEGACY_STAFF_ROLES).toContain(oldRole);
  });
});
