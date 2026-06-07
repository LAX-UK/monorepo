"use client";

import { AdminEntityDetailShell } from "@/components/admin/admin-entity-detail-shell";
import { AdminEntityTabPanel } from "@/components/admin/admin-entity-tab-panel";
import { AdminPinPageButton } from "@/components/admin/admin-pin-page-button";
import { AdminUserAccountControls } from "@/components/admin/admin-user-account-controls";
import { AdminUserAttentionBanner } from "@/components/admin/admin-user-attention-banner";
import { AdminUserDangerZone } from "@/components/admin/admin-user-danger-zone";
import { AdminUserDetailHeaderMeta } from "@/components/admin/admin-user-detail-header-meta";
import { AdminUserDisplayNameEditableTitle } from "@/components/admin/editable-titles";
import { UserDetailContextRail } from "@/components/admin/user-detail-context-rail";
import {
  type AdminDetailTab,
  AdminDetailTabs,
} from "@/components/dashboard/primitives/admin-detail-tabs";
import type { AdminUserSummaryMetrics } from "@/lib/admin/admin-user-metrics";
import type { UserAttentionItem, UserDetailRailContext } from "@/lib/admin/admin-user-readiness.vm";
import type { AdminUserDetailPayload } from "@/lib/data/http/admin.server";
import type { UserRole, UserStaffRole } from "@auction/types";
import type { ReactNode } from "react";

type TabDef = {
  id: string;
  label: string;
  content: ReactNode;
  badge?: ReactNode;
};

type Props = {
  user: AdminUserDetailPayload;
  listHref: string;
  listLabel: string;
  tabs: TabDef[];
  title?: ReactNode;
  summaryMetrics?: AdminUserSummaryMetrics;
  legalEntitiesForActions?: { id: string; displayName: string }[];
  attentionItems?: readonly UserAttentionItem[];
  railContext?: UserDetailRailContext;
  showContextRail?: boolean;
};

export function AdminUserDetailShell({
  user,
  listHref,
  listLabel,
  tabs,
  title,
  summaryMetrics,
  legalEntitiesForActions = [],
  attentionItems = [],
  railContext,
  showContextRail = true,
}: Props) {
  const isStaff = user.role === "staff";
  const detailHeaderSticky = false;
  const resolvedTitle = title ?? (
    <AdminUserDisplayNameEditableTitle userId={user.id} value={user.name} />
  );

  return (
    <AdminEntityDetailShell
      detailHeader
      detailHeaderSticky={detailHeaderSticky}
      backHref={listHref}
      backLabel={listLabel}
      title={resolvedTitle}
      actions={<AdminPinPageButton label={user.name} />}
      entityId={user.id}
      updatedAt={user.updatedAt}
      meta={
        <AdminUserDetailHeaderMeta user={user} {...(summaryMetrics ? { summaryMetrics } : {})} />
      }
      rail={
        <div className="space-y-6">
          {!isStaff && showContextRail ? (
            <UserDetailContextRail
              email={user.email}
              legalEntities={legalEntitiesForActions}
              {...(railContext ? { context: railContext } : {})}
            />
          ) : null}
          <AdminUserAccountControls
            userId={user.id}
            role={user.role as UserRole}
            staffRole={(user.staffRole as UserStaffRole | null) ?? null}
            isStaff={isStaff}
          />
          <AdminUserDangerZone userId={user.id} suspendedAt={user.suspendedAt} />
        </div>
      }
      railSticky={false}
    >
      <AdminUserAttentionBanner items={attentionItems} />
      <AdminDetailTabs
        defaultValue={tabs[0]?.id ?? "overview"}
        syncUrl
        detailHeaderSticky={detailHeaderSticky}
        tabs={tabs.map(
          (tab): AdminDetailTab => ({
            value: tab.id,
            label: tab.label,
            badge: tab.badge,
            content: <AdminEntityTabPanel>{tab.content}</AdminEntityTabPanel>,
          }),
        )}
      />
    </AdminEntityDetailShell>
  );
}
