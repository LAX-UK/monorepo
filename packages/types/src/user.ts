export const userRoles = ["user", "admin"] as const;
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
