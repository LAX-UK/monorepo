import type { UserRole } from "@auction/types";

export const permissions = {
  auction: {
    create: ["administrator"] as const,
    updateOwn: ["administrator"] as const,
    cancelOwn: ["administrator"] as const,
    manageAny: ["administrator"] as const,
  },
  bid: {
    place: ["client"] as const,
  },
  user: {
    readProfile: ["administrator", "accountant", "client"] as const,
    setRole: ["administrator"] as const,
  },
} as const;

export function roleHasPermission(role: UserRole, allowed: readonly UserRole[]): boolean {
  return (allowed as readonly string[]).includes(role);
}
