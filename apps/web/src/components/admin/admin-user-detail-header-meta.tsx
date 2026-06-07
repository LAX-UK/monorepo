import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminUserAvatar } from "@/components/admin/admin-user-avatar";
import { AdminUserSummaryStrip } from "@/components/admin/admin-user-summary-strip";
import type { AdminUserSummaryMetrics } from "@/lib/admin/admin-user-metrics";
import { formatAdminUserDate } from "@/lib/admin/format-admin-user-date";
import { relativeFromIso } from "@/lib/admin/relative-time";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import type { AdminUserDetailPayload } from "@/lib/data/http/admin.server";
import type { UserStaffRole } from "@auction/types";

type Props = {
  user: AdminUserDetailPayload;
  summaryMetrics?: AdminUserSummaryMetrics;
};

export function AdminUserDetailHeaderMeta({ user, summaryMetrics }: Props) {
  const isStaff = user.role === "staff";

  return (
    <div className="space-y-3">
      {summaryMetrics ? <AdminUserSummaryStrip metrics={summaryMetrics} /> : null}
      <div className="flex items-center gap-3">
        <AdminUserAvatar user={user} size="lg" />
        <p className="font-body text-sm text-on-surface-variant">
          {user.email} · Created {formatAdminUserDate(user.createdAt)} (
          {relativeFromIso(user.createdAt)})
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <AdminStatusBadge domain="user" status="active" label={isStaff ? "Staff" : "Client"} />
        {isStaff ? (
          <AdminStatusBadge
            domain="user"
            status="active"
            label={staffRoleLabel(user.staffRole as UserStaffRole | null)}
          />
        ) : null}
        <AdminStatusBadge domain="user" status={user.suspendedAt ? "suspended" : "active"} />
      </div>
    </div>
  );
}
