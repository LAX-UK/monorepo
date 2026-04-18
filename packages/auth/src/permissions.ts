import type { UserRole } from "@auction/types";

export const permissions = {
  auction: {
    create: ["admin"] as const,
    updateOwn: ["admin"] as const,
    cancelOwn: ["admin"] as const,
    manageAny: ["admin"] as const,
  },
  bid: {
    place: ["user", "admin"] as const,
  },
  user: {
    readProfile: ["user", "admin"] as const,
    setRole: ["admin"] as const,
  },
} as const;

export function roleHasPermission(role: UserRole, allowed: readonly UserRole[]): boolean {
  return (allowed as readonly string[]).includes(role);
}
