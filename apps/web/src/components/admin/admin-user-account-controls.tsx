import { AdminSectionLabel } from "@/components/admin/admin-section-label";
import { UserRoleAction, UserStaffRoleAction } from "@/components/admin/admin-user-actions";
import type { UserRole, UserStaffRole } from "@auction/types";

type Props = {
  userId: string;
  role: UserRole;
  staffRole: UserStaffRole | null;
  isStaff: boolean;
};

export function AdminUserAccountControls({ userId, role, staffRole, isStaff }: Props) {
  return (
    <div className="space-y-6 rounded-xl border border-border-hairline bg-surface-container-low/60 p-5">
      <AdminSectionLabel as="p">Account controls</AdminSectionLabel>
      <div className="space-y-4">
        <UserRoleAction userId={userId} defaultRole={role} layout="block" />
      </div>
      {isStaff ? (
        <div className="space-y-4 border-t border-border-hairline pt-4">
          <AdminSectionLabel as="p">Internal staff role</AdminSectionLabel>
          <UserStaffRoleAction userId={userId} defaultStaffRole={staffRole} />
        </div>
      ) : null}
    </div>
  );
}
