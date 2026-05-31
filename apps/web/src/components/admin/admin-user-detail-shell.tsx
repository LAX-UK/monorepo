"use client";

import { AdminEntityDetailShell } from "@/components/admin/admin-entity-detail-shell";
import { AdminPinPageButton } from "@/components/admin/admin-pin-page-button";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  UserRoleAction,
  UserStaffRoleAction,
  UserSuspendAction,
} from "@/components/admin/admin-user-actions";
import { AdminUserAvatar } from "@/components/admin/admin-user-avatar";
import { AdminUserQuickActions } from "@/components/admin/admin-user-quick-actions";
import {
  type AdminUserSummaryMetrics,
  AdminUserSummaryStrip,
} from "@/components/admin/admin-user-summary-strip";
import { AdminClientDisplayNameEditableTitle } from "@/components/admin/editable-titles";
import { UserDetailContextRail } from "@/components/admin/user-detail-context-rail";
import {
  type AdminDetailTab,
  AdminDetailTabs,
} from "@/components/dashboard/primitives/admin-detail-tabs";
import { formatAdminUserDate } from "@/lib/admin/format-admin-user-date";
import { relativeFromIso } from "@/lib/admin/relative-time";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import type { AdminUserDetailPayload } from "@/lib/data/http/admin.server";
import type { UserRole, UserStaffRole } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import type { ReactNode } from "react";

type TabDef = {
  id: string;
  label: string;
  content: ReactNode;
};

type Props = {
  user: AdminUserDetailPayload;
  listHref: string;
  listLabel: string;
  tabs: TabDef[];
  summaryMetrics?: AdminUserSummaryMetrics;
  legalEntitiesForActions?: { id: string; displayName: string }[];
};

export function AdminUserDetailShell({
  user,
  listHref,
  listLabel,
  tabs,
  summaryMetrics,
  legalEntitiesForActions = [],
}: Props) {
  const isStaff = user.role === "staff";

  const accountControls = (
    <div className="space-y-6 rounded-xl border border-border-hairline bg-surface-container-low/60 p-5">
      <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Account controls
      </p>
      <div className="space-y-4">
        <UserRoleAction userId={user.id} defaultRole={user.role as UserRole} layout="block" />
      </div>
      {isStaff ? (
        <div className="space-y-4 border-t border-border-hairline pt-4">
          <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Internal staff role
          </p>
          <UserStaffRoleAction
            userId={user.id}
            defaultStaffRole={(user.staffRole as UserStaffRole | null) ?? null}
          />
        </div>
      ) : null}
      <div className="border-t border-border-hairline pt-4">
        <UserSuspendAction userId={user.id} suspendedAt={user.suspendedAt} fullWidthButton />
      </div>
    </div>
  );

  return (
    <AdminEntityDetailShell
      detailHeader
      detailHeaderSticky={false}
      backHref={listHref}
      backLabel={listLabel}
      title={<AdminClientDisplayNameEditableTitle userId={user.id} value={user.name} />}
      actions={<AdminPinPageButton label={user.name} />}
      meta={
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <AdminUserAvatar user={user} size="lg" />
            <p className="font-body text-sm text-on-surface-variant">{user.email}</p>
          </div>
          {summaryMetrics ? <AdminUserSummaryStrip metrics={summaryMetrics} /> : null}
          {!isStaff ? (
            <AdminUserQuickActions
              userId={user.id}
              email={user.email}
              legalEntities={legalEntitiesForActions}
            />
          ) : null}
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
            <span className="font-body text-xs text-on-surface-variant">
              Created {formatAdminUserDate(user.createdAt)} ({relativeFromIso(user.createdAt)})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="font-mono text-xs"
              onClick={() => void navigator.clipboard.writeText(user.id)}
            >
              Copy user ID
            </Button>
          </div>
          <p className="font-mono text-xs text-on-surface-variant">{user.id}</p>
        </div>
      }
      rail={
        <div className="space-y-6">
          <UserDetailContextRail
            user={user}
            {...(summaryMetrics?.lifetimeSpend != null
              ? { lifetimeSpend: summaryMetrics.lifetimeSpend }
              : {})}
            {...(summaryMetrics?.lotsWon != null ? { lotsWon: summaryMetrics.lotsWon } : {})}
            {...(summaryMetrics?.submissionsCount != null
              ? { submissionsCount: summaryMetrics.submissionsCount }
              : {})}
            legalEntities={legalEntitiesForActions}
          />
          {accountControls}
        </div>
      }
      railSticky={false}
    >
      <AdminDetailTabs
        defaultValue={tabs[0]?.id ?? "overview"}
        tabs={tabs.map(
          (tab): AdminDetailTab => ({
            value: tab.id,
            label: tab.label,
            content: (
              <div className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-6">
                {tab.content}
              </div>
            ),
          }),
        )}
      />
    </AdminEntityDetailShell>
  );
}
