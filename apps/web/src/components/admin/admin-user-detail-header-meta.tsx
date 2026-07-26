import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { PeopleDetailMetaRow } from "@/components/admin/people/people-detail-meta-row";
import { SignupPersonaBadge } from "@/components/admin/signup-persona-badge";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import type { AdminUserDetailPayload } from "@/lib/data/http/admin.server";
import type { UserStaffRole } from "@auction/types";

type Props = {
  user: AdminUserDetailPayload;
};

export function AdminUserDetailHeaderMeta({ user }: Props) {
  const isStaff = user.role === "staff";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <AdminStatusBadge domain="user" status="active" label={isStaff ? "Staff" : "Client"} />
        {isStaff ? (
          <AdminStatusBadge
            domain="user"
            status="active"
            label={staffRoleLabel(user.staffRole as UserStaffRole | null)}
          />
        ) : (
          <SignupPersonaBadge persona={user.signupPersona} size="compact" />
        )}
        <AdminStatusBadge domain="user" status={user.suspendedAt ? "suspended" : "active"} />
        {user.emailVerified ? (
          <AdminStatusBadge domain="kyc" status="approved" label="Verified" size="sm" />
        ) : (
          <AdminStatusBadge domain="kyc" status="pending" label="Unverified" size="sm" />
        )}
      </div>
      <PeopleDetailMetaRow user={user} />
    </div>
  );
}
