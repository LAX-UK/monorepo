import type { UserRole, UserStaffRole } from "@auction/types";
import { userStaffRoles } from "@auction/types";

/** Categorical palette keys — one per displayed platform role (CSS in globals.css). */
export type PlatformRolePaletteKey =
  | "client"
  | "super_admin"
  | "auction_manager"
  | "catalogue_manager"
  | "specialist"
  | "finance_ops"
  | "operations_fulfilment"
  | "content_marketing"
  | "support_concierge"
  | "staff_viewer"
  | "compliance_officer"
  | "client_advisor"
  | "operations"
  | "staff_legacy";

export type PlatformRolePresentation = {
  /** Short label for badges and compact UI. */
  label: string;
  /** Full accessible name (includes staff prefix when relevant). */
  ariaLabel: string;
  paletteKey: PlatformRolePaletteKey;
};

const STAFF_ROLE_LABELS: Record<UserStaffRole, string> = {
  super_admin: "Super admin",
  auction_manager: "Auction manager",
  catalogue_manager: "Catalogue manager",
  specialist: "Specialist",
  finance_ops: "Finance",
  operations_fulfilment: "Operations fulfilment",
  content_marketing: "Content & marketing",
  support_concierge: "Support concierge",
  staff_viewer: "Staff viewer",
  compliance_officer: "Compliance officer",
  client_advisor: "Client advisor",
  operations: "Operations",
};

const STAFF_ROLE_PALETTE: Record<UserStaffRole, PlatformRolePaletteKey> = {
  super_admin: "super_admin",
  auction_manager: "auction_manager",
  catalogue_manager: "catalogue_manager",
  specialist: "specialist",
  finance_ops: "finance_ops",
  operations_fulfilment: "operations_fulfilment",
  content_marketing: "content_marketing",
  support_concierge: "support_concierge",
  staff_viewer: "staff_viewer",
  compliance_officer: "compliance_officer",
  client_advisor: "client_advisor",
  operations: "operations",
};

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
  "super_admin",
  "auction_manager",
  "catalogue_manager",
  "specialist",
  "finance_ops",
  "operations_fulfilment",
  "content_marketing",
  "support_concierge",
  "staff_viewer",
  "compliance_officer",
  "client_advisor",
  "operations",
  "staff_legacy",
];

export { STAFF_ROLE_LABELS, STAFF_ROLE_PALETTE };
