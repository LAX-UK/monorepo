import type { UserRole } from "@auction/types";

export const permissions = {
  auction: {
    create: ["staff"] as const,
    updateOwn: ["staff"] as const,
    cancelOwn: ["staff"] as const,
    manageAny: ["staff"] as const,
  },
  bid: {
    place: ["client"] as const,
  },
  user: {
    readProfile: ["staff", "client"] as const,
    setRole: ["staff"] as const,
  },
} as const;

export function roleHasPermission(role: UserRole, allowed: readonly UserRole[]): boolean {
  return (allowed as readonly string[]).includes(role);
}
