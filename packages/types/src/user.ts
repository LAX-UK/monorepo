/** Persisted V1 roles (see specs/003-role-model-invites). */
export const userRoles = ["administrator", "accountant", "client"] as const;
export type UserRole = (typeof userRoles)[number];

export type AppUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: UserRole;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};
