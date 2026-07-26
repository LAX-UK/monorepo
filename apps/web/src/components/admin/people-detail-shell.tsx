"use client";

import { AdminPinPageButton } from "@/components/admin/admin-pin-page-button";
import { AdminUserAccountControls } from "@/components/admin/admin-user-account-controls";
import { AdminUserAttentionBanner } from "@/components/admin/admin-user-attention-banner";
import { AdminUserDangerZone } from "@/components/admin/admin-user-danger-zone";
import { AdminUserDetailHeaderMeta } from "@/components/admin/admin-user-detail-header-meta";
import {
  CatalogBreadcrumbs,
  CatalogDetailMobileMeta,
  type CatalogDetailQueryTab,
  CatalogDetailQueryTabs,
  CatalogDetailShell,
} from "@/components/admin/catalog";
import { AdminUserDisplayNameEditableTitle } from "@/components/admin/editable-titles";
import { UserDetailContextRail } from "@/components/admin/user-detail-context-rail";
import type { UserAttentionItem, UserDetailRailContext } from "@/lib/admin/admin-user-readiness.vm";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import type { AdminUserDetailPayload } from "@/lib/data/http/admin.server";
import type { UserRole, UserStaffRole } from "@auction/types";
import type { ReactNode } from "react";

type TabDef = {
  id: string;
  label: string;
  content: ReactNode;
  badge?: ReactNode;
  count?: number;
};

type Props = {
  user: AdminUserDetailPayload;
  listHref: string;
  listLabel: string;
  tabs: TabDef[];
  title?: ReactNode;
  legalEntitiesForActions?: { id: string; displayName: string }[];
  attentionItems?: readonly UserAttentionItem[];
  railContext?: UserDetailRailContext;
  showContextRail?: boolean;
  showAccountControls?: boolean;
  showDangerZone?: boolean;
};

export function PeopleDetailShell({
  user,
  listHref,
  listLabel,
  tabs,
  title,
  legalEntitiesForActions = [],
  attentionItems = [],
  railContext,
  showContextRail = true,
  showAccountControls = true,
  showDangerZone = true,
}: Props) {
  const isStaff = user.role === "staff";
  const resolvedTitle = title ?? (
    <AdminUserDisplayNameEditableTitle userId={user.id} value={user.name} />
  );
  const description = isStaff
    ? `${user.email} · ${staffRoleLabel(user.staffRole as UserStaffRole | null)}`
    : user.email;

  const queryTabs: CatalogDetailQueryTab[] = tabs.map((tab) => ({
    id: tab.id,
    label: tab.label,
    content: tab.content,
    ...(tab.count != null ? { count: tab.count } : {}),
    ...(tab.badge ? { badgeNode: tab.badge } : {}),
  }));

  const accountControls = showAccountControls ? (
    <AdminUserAccountControls
      userId={user.id}
      role={user.role as UserRole}
      staffRole={(user.staffRole as UserStaffRole | null) ?? null}
      isStaff={isStaff}
    />
  ) : null;

  const dangerZone = showDangerZone ? (
    <AdminUserDangerZone userId={user.id} suspendedAt={user.suspendedAt} />
  ) : null;

  const clientContextRail =
    !isStaff && showContextRail ? (
      <UserDetailContextRail
        email={user.email}
        legalEntities={legalEntitiesForActions}
        {...(railContext ? { context: railContext } : {})}
      />
    ) : null;

  return (
    <CatalogDetailShell
      breadcrumbs={
        <CatalogBreadcrumbs
          segments={[{ label: listLabel, href: listHref }, { label: user.name }]}
        />
      }
      eyebrow={isStaff ? "Staff member" : "Client"}
      title={resolvedTitle}
      description={description}
      meta={<AdminUserDetailHeaderMeta user={user} />}
      metaBelowTitle
      actions={<AdminPinPageButton label={user.name} />}
      mobileMeta={<CatalogDetailMobileMeta entityId={user.id} updatedAt={user.updatedAt} />}
    >
      <AdminUserAttentionBanner items={attentionItems} />
      {!isStaff && showContextRail ? clientContextRail : null}
      <CatalogDetailQueryTabs
        tabs={queryTabs}
        defaultTab={tabs[0]?.id ?? "overview"}
        aria-label={isStaff ? "Staff sections" : "Client sections"}
      />
      {!isStaff && accountControls ? accountControls : null}
      {dangerZone}
    </CatalogDetailShell>
  );
}

/** @deprecated Use PeopleDetailShell — kept for incremental migration. */
export function AdminUserDetailShell(props: Props) {
  return <PeopleDetailShell {...props} />;
}
