import {
  type RoleCapability,
  type UserStaffRole,
  normalizeStaffRoles,
  normalizeUserStaffRole,
  staffRolesCapabilities,
} from "@auction/types";
import {
  LEGACY_STAFF_ROLE_CAPABILITIES,
  RETIRED_CAPABILITY_SUCCESSORS,
  type RetiredCapability,
  STAFF_ROLE_SUCCESSORS,
  isLegacyStaffRole,
} from "./legacy-staff-roles.js";

/** A staff member as the roster holds them before the clean-up. */
export type StaffMemberRoles = {
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  /** Roles held now or later (not ended), as stored: previous or current names. */
  readonly roles: readonly string[];
};

export type StaffRoleCleanupChange = {
  readonly member: StaffMemberRoles;
  readonly rolesBefore: readonly string[];
  readonly rolesAfter: readonly UserStaffRole[];
  /** Permissions the new roles add. Each one needs the owner's approval. */
  readonly gained: readonly RoleCapability[];
  /** Permissions the new roles take away. Must be empty for the clean-up to run. */
  readonly lost: readonly string[];
  /** Stored roles neither previous nor current: they grant nothing before or after. */
  readonly unknownRoles: readonly string[];
};

export type StaffRoleCleanupPlan = {
  readonly changes: readonly StaffRoleCleanupChange[];
  readonly peopleWithGains: number;
  readonly peopleWithLosses: number;
};

function successorsOf(role: string): readonly UserStaffRole[] {
  if (isLegacyStaffRole(role)) return STAFF_ROLE_SUCCESSORS[role];
  const current = normalizeUserStaffRole(role);
  return current ? [current] : [];
}

function capabilitiesBefore(role: string): readonly string[] {
  if (isLegacyStaffRole(role)) return LEGACY_STAFF_ROLE_CAPABILITIES[role];
  const current = normalizeUserStaffRole(role);
  return current ? [...staffRolesCapabilities([current])] : [];
}

function isRetired(capability: string): capability is RetiredCapability {
  return capability in RETIRED_CAPABILITY_SUCCESSORS;
}

/** What one person's roles and permissions become. Pure: no I/O. */
export function planStaffMemberCleanup(member: StaffMemberRoles): StaffRoleCleanupChange {
  const rolesAfter = normalizeStaffRoles(member.roles.flatMap(successorsOf));
  const before = new Set(member.roles.flatMap(capabilitiesBefore));
  const after = staffRolesCapabilities(rolesAfter);
  const keeps = (capability: string) =>
    after.has(capability as RoleCapability) ||
    (isRetired(capability) && after.has(RETIRED_CAPABILITY_SUCCESSORS[capability]));
  return {
    member,
    rolesBefore: member.roles,
    rolesAfter,
    gained: [...after].filter((capability) => !before.has(capability)).sort(),
    lost: [...before].filter((capability) => !keeps(capability)).sort(),
    unknownRoles: member.roles.filter((role) => successorsOf(role).length === 0),
  };
}

/** The clean-up for everyone on the roster, in the order given. */
export function planStaffRoleCleanup(members: readonly StaffMemberRoles[]): StaffRoleCleanupPlan {
  const changes = members.map(planStaffMemberCleanup);
  return {
    changes,
    peopleWithGains: changes.filter((c) => c.gained.length > 0).length,
    peopleWithLosses: changes.filter((c) => c.lost.length > 0).length,
  };
}
