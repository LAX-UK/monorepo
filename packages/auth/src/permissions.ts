import type { UserRole } from "@auction/types";

export const permissions = {
  auction: {
    create: ["seller", "admin"] as const,
    updateOwn: ["seller", "admin"] as const,
    cancelOwn: ["seller", "admin"] as const,
    manageAny: ["admin"] as const,
  },
  bid: {
    place: ["buyer", "seller", "admin"] as const,
  },
  user: {
    readProfile: ["buyer", "seller", "admin"] as const,
    setRole: ["admin"] as const,
  },
} as const;

export function roleHasPermission(
  role: UserRole,
  allowed: readonly UserRole[],
): boolean {
  return (allowed as readonly string[]).includes(role);
}
