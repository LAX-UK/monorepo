import type { UserStaffRole } from "@auction/types";
import { userStaffRoles } from "@auction/types";

/** Human-readable label for internal staff roles. */
export function staffRoleLabel(role: UserStaffRole | null | undefined): string {
  if (role == null) return "Default (legacy full)";
  return role.replace(/_/g, " ");
}

export const staffRoleFilterOptions: { value: UserStaffRole; label: string }[] = userStaffRoles.map(
  (value) => ({
    value,
    label: staffRoleLabel(value),
  }),
);
