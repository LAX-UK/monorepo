import { describe, expect, it } from "vitest";
import { type UserStaffRole, userStaffRoles } from "../user.js";
import { effectivePermissions } from "./effective-permissions.js";
import { roleHasCapability } from "./role-capabilities.js";
import type { RoleCapability } from "./role-capability.js";
import {
  canAccessPlatformAdminRoutes,
  staffRoleDefaultDestination,
  staffRoleToShellLayout,
} from "./role-route-policy.js";

/**
 * What each staff account could do when every person held exactly one role, captured from the
 * single-role policy before role assignments replaced it. Moving to assignments must leave every
 * row unchanged; a deliberate role change updates this table in the same commit.
 */
const SINGLE_ROLE_BASELINE: Record<
  UserStaffRole,
  {
    capabilities: readonly RoleCapability[];
    platformRoutes: boolean;
    shell: "platform" | "finance";
    destination: string;
  }
> = {
  super_admin: {
    capabilities: [
      "platform.admin.full",
      "finance.read",
      "finance.platform.write",
      "finance.entity.write",
      "finance.write",
      "user.invite",
      "auction.manage",
      "legal_entity.read",
      "legal_entity.write",
      "legal_entity.approve",
      "legal_entity.archive",
      "artist.read",
      "artist.review",
      "artist.merge",
      "artist.delete",
      "payout.read",
      "payout.process",
      "payout.reverse",
      "audit.read_pii",
      "catalogue.write",
      "specialist.appraise",
      "operations.fulfilment",
      "content.write",
      "support.respond",
      "client.read",
      "bids.read",
      "aml.review",
      "compliance.mlro",
    ],
    platformRoutes: true,
    shell: "platform",
    destination: "/admin",
  },
  auction_manager: {
    capabilities: ["auction.manage", "legal_entity.read", "legal_entity.write", "artist.read"],
    platformRoutes: true,
    shell: "platform",
    destination: "/admin/sales",
  },
  catalogue_manager: {
    capabilities: [
      "legal_entity.read",
      "artist.read",
      "artist.review",
      "artist.delete",
      "catalogue.write",
    ],
    platformRoutes: true,
    shell: "platform",
    destination: "/admin/lots",
  },
  specialist: {
    capabilities: ["legal_entity.read", "artist.read", "artist.review", "specialist.appraise"],
    platformRoutes: true,
    shell: "platform",
    destination: "/admin/submissions",
  },
  finance_ops: {
    capabilities: [
      "finance.read",
      "finance.platform.write",
      "legal_entity.read",
      "payout.read",
      "payout.process",
    ],
    platformRoutes: false,
    shell: "finance",
    destination: "/admin/finance",
  },
  operations_fulfilment: {
    capabilities: ["legal_entity.read", "artist.read", "operations.fulfilment"],
    platformRoutes: true,
    shell: "platform",
    destination: "/admin/lot-fulfilment",
  },
  content_marketing: {
    capabilities: ["artist.read", "content.write"],
    platformRoutes: true,
    shell: "platform",
    destination: "/admin/artists",
  },
  support_concierge: {
    capabilities: ["legal_entity.read", "artist.read", "support.respond"],
    platformRoutes: true,
    shell: "platform",
    destination: "/admin/legal-entities",
  },
  staff_viewer: {
    capabilities: ["legal_entity.read", "artist.read"],
    platformRoutes: true,
    shell: "platform",
    destination: "/admin/legal-entities",
  },
  compliance_officer: {
    capabilities: ["legal_entity.read", "audit.read_pii", "aml.review", "compliance.mlro"],
    platformRoutes: true,
    shell: "platform",
    destination: "/admin/compliance/aml",
  },
  client_advisor: {
    capabilities: ["legal_entity.read", "artist.read", "client.read", "bids.read"],
    platformRoutes: true,
    shell: "platform",
    destination: "/admin/clients",
  },
  operations: {
    capabilities: [
      "auction.manage",
      "legal_entity.read",
      "artist.read",
      "catalogue.write",
      "operations.fulfilment",
      "client.read",
    ],
    platformRoutes: true,
    shell: "platform",
    destination: "/admin/sales",
  },
};

const NOW = new Date("2026-10-28T12:00:00Z");

/** The one assignment the migration gives each existing staff member. */
function migrated(role: UserStaffRole) {
  return [{ role, startsAt: new Date("2026-10-28T00:00:00Z"), endsAt: null }];
}

describe("single role to role assignments: nobody's access changes", () => {
  it("covers every staff role", () => {
    expect(Object.keys(SINGLE_ROLE_BASELINE).sort()).toEqual([...userStaffRoles].sort());
  });

  for (const role of userStaffRoles) {
    const before = SINGLE_ROLE_BASELINE[role];

    it(`${role}: the effective permissions equal the single-role capabilities`, () => {
      const after = effectivePermissions(migrated(role), NOW);
      expect([...after].sort()).toEqual([...before.capabilities].sort());
    });

    it(`${role}: capability checks, shell and landing page are unchanged`, () => {
      const roles = [role];
      for (const capability of before.capabilities) {
        expect(roleHasCapability("staff", capability, roles)).toBe(true);
      }
      expect(roleHasCapability("staff", "bid.place", roles)).toBe(false);
      expect(roleHasCapability("staff", "client.submit", roles)).toBe(false);
      expect(canAccessPlatformAdminRoutes("staff", roles)).toBe(before.platformRoutes);
      expect(staffRoleToShellLayout("staff", roles)).toBe(before.shell);
      expect(staffRoleDefaultDestination("staff", roles)).toBe(before.destination);
    });
  }
});
