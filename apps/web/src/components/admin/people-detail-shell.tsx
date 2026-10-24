"use client";

import { AdminUserAccountControls } from "@/components/admin/admin-user-account-controls";
import { AdminUserAttentionBanner } from "@/components/admin/admin-user-attention-banner";
import { AdminUserDangerZone } from "@/components/admin/admin-user-danger-zone";
import { AdminUserDisplayNameEditableTitle } from "@/components/admin/editable-titles";
import { UserDetailContextRail } from "@/components/admin/user-detail-context-rail";
import type { UserAttentionItem, UserDetailRailContext } from "@/lib/admin/admin-user-readiness.vm";
import { toStaffStatus } from "@/lib/admin/staff-kit-status";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import type { AdminUserDetailPayload } from "@/lib/data/http/admin.server";
import { kycStatusLabel, kycStatusToBadgeVariant } from "@/lib/presenters/status-presentation";
import {
  MetaItem,
  OverflowMenu,
  PageHeader,
  STAFF_PAGE_TITLE_CLASS,
  StaffBreadcrumbs,
  type StaffLinkComponent,
  StatusBadge,
  TabNav,
  formatStaffDateTime,
  toast,
} from "@auction/staff-ui";
import type { UserRole, UserStaffRole } from "@auction/types";
import { Copy, Mail } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

const NextLink: StaffLinkComponent = Link;

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

/**
 * A person's page (client or staff) in the staff kit: who they are and their standing in the
 * header, sections as tabs that keep `?tab=` bookmarks, account controls, and the danger zone at
 * the foot, shown only to roles that may moderate accounts.
 */
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
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const isStaff = user.role === "staff";
  const defaultTab = tabs[0]?.id ?? "overview";
  const activeTab = tabs.find((tab) => tab.id === searchParams.get("tab"))?.id ?? defaultTab;
  const tabHref = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id === defaultTab) params.delete("tab");
    else params.set("tab", id);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };
  const kyc = toStaffStatus(
    kycStatusToBadgeVariant(user.kycStatus),
    kycStatusLabel(user.kycStatus),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={
          <StaffBreadcrumbs
            Link={NextLink}
            items={[{ label: listLabel, href: listHref }, { label: user.name }]}
          />
        }
        title={
          title ?? (
            <AdminUserDisplayNameEditableTitle
              userId={user.id}
              value={user.name}
              textClassName={`${STAFF_PAGE_TITLE_CLASS} overflow-visible whitespace-normal`}
            />
          )
        }
        status={
          <>
            <StatusBadge tone={user.suspendedAt ? "danger" : "success"}>
              {user.suspendedAt ? "Suspended" : "Active"}
            </StatusBadge>
            {isStaff ? (
              <StatusBadge tone="neutral">
                {staffRoleLabel(user.staffRole as UserStaffRole | null)}
              </StatusBadge>
            ) : null}
          </>
        }
        meta={
          <>
            <MetaItem label="Email">
              {user.email}
              {user.emailVerified ? "" : " (not verified)"}
            </MetaItem>
            {!isStaff ? (
              <MetaItem label="Identity">
                <StatusBadge tone={kyc.tone}>{kyc.label}</StatusBadge>
              </MetaItem>
            ) : null}
            <MetaItem label="Two-step">{user.twoFactorEnabled ? "On" : "Off"}</MetaItem>
            <MetaItem label="Joined">{formatStaffDateTime(user.createdAt)}</MetaItem>
          </>
        }
        overflow={
          <OverflowMenu
            label="More account actions"
            actions={[
              {
                id: "copy",
                label: "Copy user ID",
                icon: Copy,
                onSelect: () => {
                  void navigator.clipboard
                    ?.writeText(user.id)
                    .then(() => toast.success("User ID copied"));
                },
              },
              {
                id: "email",
                label: "Email this person",
                icon: Mail,
                onSelect: () => window.open(`mailto:${user.email}`),
              },
            ]}
          />
        }
        tabs={
          tabs.length > 1 ? (
            <TabNav
              label={isStaff ? "Staff sections" : "Client sections"}
              Link={NextLink}
              activeId={activeTab}
              items={tabs.map((tab) => ({
                id: tab.id,
                label: tab.label,
                href: tabHref(tab.id),
                ...(tab.count != null ? { count: tab.count } : {}),
              }))}
            />
          ) : null
        }
      />
      <AdminUserAttentionBanner items={attentionItems} />
      <div
        className={
          !isStaff && showContextRail
            ? "grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"
            : undefined
        }
      >
        <div className="flex min-w-0 flex-col gap-6">
          {tabs.find((tab) => tab.id === activeTab)?.content}
          {!isStaff && showAccountControls ? (
            <AdminUserAccountControls
              userId={user.id}
              role={user.role as UserRole}
              staffRole={(user.staffRole as UserStaffRole | null) ?? null}
              isStaff={isStaff}
            />
          ) : null}
          {showDangerZone ? (
            <AdminUserDangerZone
              userId={user.id}
              suspendedAt={user.suspendedAt}
              twoFactorEnabled={user.twoFactorEnabled}
            />
          ) : null}
        </div>
        {!isStaff && showContextRail ? (
          <UserDetailContextRail
            email={user.email}
            legalEntities={legalEntitiesForActions}
            {...(railContext ? { context: railContext } : {})}
          />
        ) : null}
      </div>
    </div>
  );
}

/** @deprecated Use PeopleDetailShell — kept for incremental migration. */
export function AdminUserDetailShell(props: Props) {
  return <PeopleDetailShell {...props} />;
}
