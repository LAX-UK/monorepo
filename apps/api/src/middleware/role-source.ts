import type { Context } from "hono";

export type RoleSource = {
  getRole(c: Context): string | null;
};

export const honoContextRoleSource: RoleSource = {
  getRole(c) {
    return (c.get("userRole") as string | undefined) ?? null;
  },
};
