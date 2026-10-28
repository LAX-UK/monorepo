import type { UserRole, UserStaffRole } from "@auction/types";
import { laxStaffPlatform, userStaffRoles } from "@auction/types";

/** Categorical palette keys — one per displayed platform role (CSS in globals.css). */
export type PlatformRolePaletteKey = "client" | UserStaffRole | "staff_legacy";

export type PlatformRolePresentation = {
  /** Short label for badges and compact UI. */
  label: string;
  /** Full accessible name (includes staff prefix when relevant). */
  ariaLabel: string;
  paletteKey: PlatformRolePaletteKey;
};

const STAFF_ROLE_LABELS = Object.fromEntries(
  laxStaffPlatform("bid").roles.map((r) => [r.value, r.label]),
) as Record<UserStaffRole, string>;

/** Each staff role has its own badge colour, keyed by the role itself. */
const STAFF_ROLE_PALETTE = Object.fromEntries(userStaffRoles.map((role) => [role, role])) as Record<
  UserStaffRole,
  PlatformRolePaletteKey
>;

const CLIENT_PRESENTATION: PlatformRolePresentation = {
  label: "Client",
  ariaLabel: "Client",
  paletteKey: "client",
};

const STAFF_LEGACY_PRESENTATION: PlatformRolePresentation = {
  label: "Staff",
  ariaLabel: "Staff — default legacy full access",
  paletteKey: "staff_legacy",
};

function staffPresentation(staffRole: UserStaffRole): PlatformRolePresentation {
  const label = STAFF_ROLE_LABELS[staffRole];
  return {
    label,
    ariaLabel: `Staff — ${label}`,
    paletteKey: STAFF_ROLE_PALETTE[staffRole],
  };
}

/** Resolve invitation/user platform role into badge copy and palette. */
export function resolvePlatformRolePresentation(
  targetRole: UserRole,
  targetStaffRole: UserStaffRole | null,
): PlatformRolePresentation {
  if (targetRole === "client") {
    return CLIENT_PRESENTATION;
  }
  if (targetStaffRole == null) {
    return STAFF_LEGACY_PRESENTATION;
  }
  return staffPresentation(targetStaffRole);
}

/** Human-readable label for internal staff roles (string helpers). */
export function staffRoleLabel(role: UserStaffRole | null | undefined): string {
  if (role == null) return "Default (legacy full)";
  return STAFF_ROLE_LABELS[role];
}

/** Invitation list/detail string (compatibility). */
export function invitationRoleLabel(
  targetRole: UserRole,
  targetStaffRole: UserStaffRole | null,
): string {
  if (targetRole === "staff") {
    return `Staff – ${staffRoleLabel(targetStaffRole)}`;
  }
  return "Client";
}

export const staffRoleFilterOptions: { value: UserStaffRole; label: string }[] = userStaffRoles.map(
  (value) => ({
    value,
    label: STAFF_ROLE_LABELS[value],
  }),
);

export const platformRolePaletteKeys: PlatformRolePaletteKey[] = [
  "client",
  ...userStaffRoles,
  "staff_legacy",
];

export { STAFF_ROLE_LABELS, STAFF_ROLE_PALETTE };
