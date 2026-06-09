import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import type { UserRole, UserStaffRole } from "@auction/types";

export function invitationRoleLabel(
  targetRole: UserRole,
  targetStaffRole: UserStaffRole | null,
): string {
  if (targetRole === "staff") {
    return `Staff – ${staffRoleLabel(targetStaffRole)}`;
  }
  return "Client";
}
