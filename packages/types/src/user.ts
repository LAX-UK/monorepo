/** Persisted roles (see specs/003-role-model-invites). */
export const userRoles = ["staff", "client"] as const;
export type UserRole = (typeof userRoles)[number];

/** LAX internal staff role (`user.staff_role`); required when `user.role` is `staff`. */
export const userStaffRoles = [
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
] as const;
export type UserStaffRole = (typeof userStaffRoles)[number];

const staffRoleSet = new Set<string>(userStaffRoles);

export function normalizeUserStaffRole(s: string | null | undefined): UserStaffRole | null {
  if (s == null || s === "") return null;
  const t = s.trim().toLowerCase().replace(/-/g, "_");
  if (staffRoleSet.has(t)) return t as UserStaffRole;
  return null;
}
export const userEmailStatuses = ["ok", "bounced", "complained"] as const;
export type UserEmailStatus = (typeof userEmailStatuses)[number];

export type AppUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: UserRole;
  staffRole?: UserStaffRole | null;
  emailVerified: boolean;
  emailStatus: UserEmailStatus;
  emailStatusChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
