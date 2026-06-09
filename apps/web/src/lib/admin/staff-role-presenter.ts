import type { UserStaffRole } from "@auction/types";
import { userStaffRoles } from "@auction/types";

const STAFF_ROLE_LABELS: Partial<Record<UserStaffRole, string>> = {
  client_advisor: "Client advisor",
  operations: "Operations",
};

/** Human-readable label for internal staff roles. */
export function staffRoleLabel(role: UserStaffRole | null | undefined): string {
  if (role == null) return "Default (legacy full)";
  return STAFF_ROLE_LABELS[role] ?? role.replace(/_/g, " ");
}

export const staffRoleFilterOptions: { value: UserStaffRole; label: string }[] = userStaffRoles.map(
  (value) => ({
    value,
    label: staffRoleLabel(value),
  }),
);
