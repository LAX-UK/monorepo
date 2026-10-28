import {
  SHOP_STAFF_ROLES,
  type ShopStaffCapability,
  type ShopStaffRole,
  capabilitiesForRoles,
} from "./staff-capabilities.js";

/**
 * The roles each person's single LAX Admin role becomes when people can hold several. Catalogue
 * editors keep editorial work through the new Editor role, so nobody loses access. Migration 0248
 * applies exactly this table; a test pins the two together.
 */
export const LAX_ADMIN_ROLE_SUCCESSORS: Readonly<Record<string, readonly ShopStaffRole[]>> = {
  shop_admin: ["shop_admin"],
  account_manager: ["account_manager"],
  broker: ["broker"],
  operations: ["operations"],
  finance: ["finance"],
  catalogue_editor: ["catalogue_editor", "editor"],
};

/** Capabilities the single role gave before the split; editorial work sat with catalogue editors. */
const CAPABILITIES_BEFORE: Readonly<Record<string, readonly ShopStaffCapability[]>> = {
  catalogue_editor: [
    "catalogue.write",
    "editorial.write",
    "editorial.publish",
    "artist_application.review",
  ],
};

export type LaxAdminRoleMigrationMember = {
  readonly subjectId: string;
  readonly name: string | null;
  readonly email: string | null;
  /** The single role stored today. */
  readonly role: string;
};

export type LaxAdminRoleMigrationChange = {
  readonly member: LaxAdminRoleMigrationMember;
  readonly rolesAfter: readonly ShopStaffRole[];
  readonly gained: readonly ShopStaffCapability[];
  readonly lost: readonly ShopStaffCapability[];
  /** The stored role is not one the migration knows; it would stop and nothing would change. */
  readonly unknownRole: boolean;
};

export type LaxAdminRoleMigrationPlan = {
  readonly changes: readonly LaxAdminRoleMigrationChange[];
  readonly peopleWithGains: number;
  readonly peopleWithLosses: number;
};

function capabilitiesBefore(role: string): ReadonlySet<ShopStaffCapability> {
  const listed = CAPABILITIES_BEFORE[role];
  if (listed) return new Set(listed);
  return (SHOP_STAFF_ROLES as readonly string[]).includes(role)
    ? capabilitiesForRoles([role as ShopStaffRole])
    : new Set();
}

/** Every active member's roles after the migration and the capabilities they gain or lose. */
export function planLaxAdminRoleMigration(
  members: readonly LaxAdminRoleMigrationMember[],
): LaxAdminRoleMigrationPlan {
  const changes = members.map((member): LaxAdminRoleMigrationChange => {
    const successors = LAX_ADMIN_ROLE_SUCCESSORS[member.role];
    const rolesAfter = successors ?? [];
    const before = capabilitiesBefore(member.role);
    const after = capabilitiesForRoles(rolesAfter);
    return {
      member,
      rolesAfter,
      gained: [...after].filter((c) => !before.has(c)),
      lost: [...before].filter((c) => !after.has(c)),
      unknownRole: successors === undefined,
    };
  });
  return {
    changes,
    peopleWithGains: changes.filter((c) => c.gained.length > 0).length,
    peopleWithLosses: changes.filter((c) => c.lost.length > 0 || c.unknownRole).length,
  };
}
