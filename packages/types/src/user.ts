/** Persisted V1 roles (see specs/003-role-model-invites). */
export const userRoles = ["administrator", "accountant", "client"] as const;
export type UserRole = (typeof userRoles)[number];
export const userEmailStatuses = ["ok", "bounced", "complained"] as const;
export type UserEmailStatus = (typeof userEmailStatuses)[number];

export type AppUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: UserRole;
  emailVerified: boolean;
  emailStatus: UserEmailStatus;
  emailStatusChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
