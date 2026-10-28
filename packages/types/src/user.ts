/** Persisted roles (see docs/V1_PRODUCT_SPEC.md and packages/types role policy). */
export const userRoles = ["staff", "client"] as const;
export type UserRole = (typeof userRoles)[number];

/**
 * LAX internal staff roles, one per job. A person may hold several; their permissions are the
 * union of the roles in force. The order is the display order and decides the single role
 * screens show when there is room for one.
 */
export const userStaffRoles = [
  "administrator",
  "sales_manager",
  "saleroom_clerk",
  "cataloguer",
  "specialist",
  "client_services",
  "finance",
  "fulfilment",
  "compliance",
  "read_only",
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
