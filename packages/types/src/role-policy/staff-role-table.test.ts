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
import { staffRolesGranting } from "./staff-capability-matrix.js";

/**
 * What each Bid staff role may do on its own: its permissions, whether it opens the platform
 * shell, and where it lands after sign-in. A deliberate role change updates this table in the
 * same commit.
 */
const ROLE_TABLE: Record<
  UserStaffRole,
  {
    capabilities: readonly RoleCapability[];
    platformRoutes: boolean;
    shell: "platform" | "finance";
    destination: string;
  }
> = {
  administrator: {
    capabilities: [
      "platform.admin.full",
      "finance.read",
      "finance.platform.write",
      "finance.entity.write",
      "finance.write",
      "user.invite",
      "auction.manage",
      "saleroom.operate",
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
      "support.respond",
      "client.read",
      "bids.read",
      "aml.review",
      "compliance.mlro",
      "admin.read",
    ],
    platformRoutes: true,
    shell: "platform",
    destination: "/admin",
  },
  sales_manager: {
    capabilities: ["auction.manage", "legal_entity.read", "legal_entity.write", "artist.read"],
    platformRoutes: true,
    shell: "platform",
    destination: "/admin/sales",
  },
  saleroom_clerk: {
    capabilities: ["saleroom.operate", "bids.read", "legal_entity.read"],
    platformRoutes: true,
    shell: "platform",
    destination: "/admin/saleroom",
  },
  cataloguer: {
    capabilities: [
      "catalogue.write",
      "artist.read",
      "artist.review",
      "artist.delete",
      "legal_entity.read",
    ],
    platformRoutes: true,
    shell: "platform",
    destination: "/admin/lots",
  },
  specialist: {
    capabilities: ["specialist.appraise", "artist.read", "artist.review", "legal_entity.read"],
    platformRoutes: true,
    shell: "platform",
    destination: "/admin/submissions",
  },
  client_services: {
    capabilities: [
      "client.read",
      "bids.read",
      "support.respond",
      "legal_entity.read",
      "artist.read",
    ],
    platformRoutes: true,
    shell: "platform",
    destination: "/admin/clients",
  },
  finance: {
    capabilities: [
      "finance.read",
      "finance.platform.write",
      "payout.read",
      "payout.process",
      "legal_entity.read",
    ],
    platformRoutes: false,
    shell: "finance",
    destination: "/admin/finance",
  },
  fulfilment: {
    capabilities: ["operations.fulfilment", "legal_entity.read", "artist.read"],
    platformRoutes: true,
    shell: "platform",
    destination: "/admin/lot-fulfilment",
  },
  compliance: {
    capabilities: ["aml.review", "compliance.mlro", "legal_entity.read", "audit.read_pii"],
    platformRoutes: true,
    shell: "platform",
    destination: "/admin/compliance/aml",
  },
  read_only: {
    capabilities: ["admin.read", "legal_entity.read", "artist.read"],
    platformRoutes: true,
    shell: "platform",
    destination: "/admin/legal-entities",
  },
};

const NOW = new Date("2026-10-28T12:00:00Z");

function holding(role: UserStaffRole) {
  return [{ role, startsAt: new Date("2026-10-28T00:00:00Z"), endsAt: null }];
}

describe("Bid staff role table", () => {
  it("covers every staff role", () => {
    expect(Object.keys(ROLE_TABLE).sort()).toEqual([...userStaffRoles].sort());
  });

  for (const role of userStaffRoles) {
    const expected = ROLE_TABLE[role];

    it(`${role}: holds exactly its permissions`, () => {
      const permissions = effectivePermissions(holding(role), NOW);
      expect([...permissions].sort()).toEqual([...expected.capabilities].sort());
    });

    it(`${role}: shell, landing page and no client capabilities`, () => {
      const roles = [role];
      expect(roleHasCapability("staff", "bid.place", roles)).toBe(false);
      expect(roleHasCapability("staff", "client.submit", roles)).toBe(false);
      expect(canAccessPlatformAdminRoutes("staff", roles)).toBe(expected.platformRoutes);
      expect(staffRoleToShellLayout("staff", roles)).toBe(expected.shell);
      expect(staffRoleDefaultDestination("staff", roles)).toBe(expected.destination);
    });
  }

  it("keeps reversing payouts, organisation approval, artist merges and staff invitations with the administrator", () => {
    for (const capability of [
      "payout.reverse",
      "legal_entity.approve",
      "legal_entity.archive",
      "artist.merge",
      "user.invite",
    ] as const) {
      expect(staffRolesGranting([capability])).toEqual(["administrator"]);
    }
  });

  it("lists the roles that grant a permission in canonical order", () => {
    expect(staffRolesGranting(["compliance.mlro"])).toEqual(["administrator", "compliance"]);
    expect(
      staffRolesGranting(["specialist.appraise", "catalogue.write", "auction.manage"]),
    ).toEqual(["administrator", "sales_manager", "cataloguer", "specialist"]);
  });
});
