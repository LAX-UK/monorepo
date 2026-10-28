import { describe, expect, it } from "vitest";
import { effectivePermissions, staffRolesCapabilities } from "./effective-permissions.js";
import { effectiveCapabilities, roleHasCapability } from "./role-capabilities.js";
import { staffRoleCapabilities } from "./staff-capability-matrix.js";
import { activeStaffRoles, isStaffRoleAssignmentActive } from "./staff-role-assignment.js";
import { normalizeStaffRoles, primaryStaffRole } from "./staff-roles.js";

const NOW = new Date("2026-10-28T12:00:00Z");
const HOUR = 3_600_000;
const at = (offsetHours: number) => new Date(NOW.getTime() + offsetHours * HOUR);

describe("effectivePermissions", () => {
  it("is the union of the active roles' capabilities", () => {
    const caps = effectivePermissions(
      [
        { role: "specialist", startsAt: at(-1), endsAt: null },
        { role: "client_services", startsAt: at(-1), endsAt: null },
      ],
      NOW,
    );
    expect(caps.has("specialist.appraise")).toBe(true);
    expect(caps.has("bids.read")).toBe(true);
    expect(caps.has("catalogue.write")).toBe(false);
    const expected = new Set([
      ...staffRoleCapabilities("specialist"),
      ...staffRoleCapabilities("client_services"),
    ]);
    expect([...caps].sort()).toEqual([...expected].sort());
  });

  it("ignores roles that ended or have not started", () => {
    const caps = effectivePermissions(
      [
        { role: "cataloguer", startsAt: at(-5), endsAt: at(-1) },
        { role: "sales_manager", startsAt: at(1), endsAt: null },
        { role: "read_only", startsAt: at(-5), endsAt: NOW },
      ],
      NOW,
    );
    expect(caps.size).toBe(0);
  });

  it("counts a role from the instant it starts until the instant it ends", () => {
    const assignment = { role: "specialist" as const, startsAt: NOW, endsAt: at(1) };
    expect(isStaffRoleAssignmentActive(assignment, NOW)).toBe(true);
    expect(isStaffRoleAssignmentActive(assignment, at(1))).toBe(false);
  });

  it("keeps every capability for the administrator", () => {
    const caps = effectivePermissions(
      [{ role: "administrator", startsAt: at(-1), endsAt: null }],
      NOW,
    );
    expect([...caps].sort()).toEqual([...staffRoleCapabilities("administrator")].sort());
    expect(caps.has("platform.admin.full")).toBe(true);
  });

  it("has nothing without roles", () => {
    expect(effectivePermissions([], NOW).size).toBe(0);
    expect(staffRolesCapabilities([]).size).toBe(0);
  });
});

describe("staff never act as clients", () => {
  it("no staff role or combination grants bid.place or client.submit", () => {
    const everyRole = normalizeStaffRoles(["administrator", "specialist", "finance"]);
    expect(roleHasCapability("staff", "bid.place", everyRole)).toBe(false);
    expect(roleHasCapability("staff", "client.submit", everyRole)).toBe(false);
  });

  it("clients keep their fixed capabilities whatever roles are passed", () => {
    expect([...effectiveCapabilities("client")].sort()).toEqual(["bid.place", "client.submit"]);
    expect(roleHasCapability("client", "platform.admin.full", ["administrator"])).toBe(false);
  });
});

describe("active roles", () => {
  it("lists each active role once in canonical order", () => {
    expect(
      activeStaffRoles(
        [
          { role: "client_services", startsAt: at(-1), endsAt: null },
          { role: "specialist", startsAt: at(-2), endsAt: null },
          { role: "specialist", startsAt: at(-9), endsAt: at(-3) },
        ],
        NOW,
      ),
    ).toEqual(["specialist", "client_services"]);
  });

  it("drops unknown values and picks the first canonical role as primary", () => {
    expect(normalizeStaffRoles(["client_services", "nope", null, "sales_manager"])).toEqual([
      "sales_manager",
      "client_services",
    ]);
    expect(primaryStaffRole(["client_services", "sales_manager"])).toBe("sales_manager");
    expect(primaryStaffRole([])).toBeNull();
  });
});
