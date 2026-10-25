"use client";

import {
  type PersonActionAccess,
  type PersonActionTarget,
  usePersonActions,
} from "@/components/admin/people/use-person-actions";
import { StaffEditableTitle } from "@/components/admin/staff/staff-editable-title";
import { UserDetailContextRail } from "@/components/admin/user-detail-context-rail";
import { adminUpdateClientDisplayNameFieldAction } from "@/lib/actions/admin/field-updates";
import type { UserAttentionItem, UserDetailRailContext } from "@/lib/admin/admin-user-readiness.vm";
import { staffIdentityStatus, staffStatus } from "@/lib/admin/staff-kit-status";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import type { AdminUserDetailPayload } from "@/lib/data/http/admin.server";
import { notify } from "@/lib/ui/notify";
import {
  DetailColumns,
  DetailPage,
  type IssueItem,
  IssueList,
  MetaItem,
  type OverflowAction,
  OverflowMenu,
  StaffBreadcrumbs,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
  StatusBadge,
  TabNav,
} from "@auction/staff-ui";
import type { LegalEntity, UserRole, UserStaffRole } from "@auction/types";
import { Copy, Mail } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

const NextLink: StaffLinkComponent = Link;

const ISSUE_TONE = { critical: "danger", warning: "warning", info: "neutral" } as const;

export type PeopleDetailTab = {
  id: string;
  label: string;
  content: ReactNode;
  count?: number;
};

type Props = {
  user: AdminUserDetailPayload;
  /** The list this person was opened from, with `returnTo` applied. */
  listHref: string;
  listLabel: string;
  access: PersonActionAccess;
  tabs: PeopleDetailTab[];
  attentionItems?: readonly UserAttentionItem[];
  /** Clients only: the side column with their standing and seller organisations. */
  railContext?: UserDetailRailContext;
  legalEntitiesForActions?: Pick<LegalEntity, "id" | "displayName">[];
  showContextRail?: boolean;
};

function copy(value: string, noun: string) {
  void navigator.clipboard
    ?.writeText(value)
    .then(() => notify.success(`${noun} copied`))
    .catch(() => notify.error(`Could not copy the ${noun.toLowerCase()}`));
}

/**
 * A person's page (client or staff) on the staff record template: who they are and their
 * standing in the header, account actions in the header and overflow menu (the destructive ones
 * last, each confirmed through the kit), what needs attention, then the person's sections, as
 * `?tab=` tabs when there are several, beside a rail of context for clients.
 */
export function PeopleDetailShell({
  user,
  listHref,
  listLabel,
  access,
  tabs,
  attentionItems = [],
  railContext,
  legalEntitiesForActions = [],
  showContextRail = true,
}: Props) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const actions = usePersonActions(access);
  const isStaff = user.role === "staff";
  const canAct = access.canModerate || access.canManageRoles;

  const defaultTab = tabs[0]?.id ?? "overview";
  const activeTab = tabs.find((tab) => tab.id === searchParams.get("tab"))?.id ?? defaultTab;
  const tabHref = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id === defaultTab) params.delete("tab");
    else params.set("tab", id);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const standing = staffStatus("user", user.suspendedAt ? "suspended" : "active");
  const identity = staffIdentityStatus(user.kycStatus);
  const staffRole = (user.staffRole as UserStaffRole | null) ?? null;
  const target: PersonActionTarget = {
    id: user.id,
    name: user.name,
    role: user.role as UserRole,
    staffRole,
    suspended: Boolean(user.suspendedAt),
    twoFactorEnabled: user.twoFactorEnabled,
  };

  const overflow: OverflowAction[] = [
    {
      id: "copy-id",
      label: "Copy user ID",
      icon: Copy,
      onSelect: () => copy(user.id, "User ID"),
    },
    {
      id: "copy-email",
      label: "Copy email",
      icon: Mail,
      onSelect: () => copy(user.email, "Email"),
    },
    // Changing the role has its own button in the header.
    ...actions.actionsFor(target).filter((action) => action.id !== "role"),
  ];

  const issues: IssueItem[] = attentionItems.map((item) => ({
    id: item.id,
    label: item.message,
    tone: ISSUE_TONE[item.severity],
    action: { label: "Review", href: item.href },
  }));

  const rail =
    !isStaff && showContextRail ? (
      <UserDetailContextRail
        legalEntities={legalEntitiesForActions}
        {...(railContext ? { context: railContext } : {})}
      />
    ) : null;

  return (
    <>
      <DetailPage
        renderHeading
        breadcrumbs={
          <StaffBreadcrumbs
            Link={NextLink}
            items={[{ label: listLabel, href: listHref }, { label: user.name }]}
          />
        }
        title={
          <StaffEditableTitle
            value={user.name}
            label={isStaff ? "staff member" : "client"}
            editable={canAct}
            onSave={(next) => adminUpdateClientDisplayNameFieldAction(user.id, next)}
          />
        }
        status={
          <>
            <StatusBadge tone={standing.tone}>{standing.label}</StatusBadge>
            {isStaff ? (
              <StatusBadge tone="neutral">{staffRoleLabel(staffRole)}</StatusBadge>
            ) : (
              <StatusBadge tone={identity.tone}>{identity.label}</StatusBadge>
            )}
          </>
        }
        meta={
          <>
            <MetaItem label="Email">
              {user.email}
              {user.emailVerified ? null : (
                <span className="text-staff-muted"> · Not verified</span>
              )}
            </MetaItem>
            <MetaItem label="Two-step">
              {user.securityStatusAvailable
                ? user.twoFactorEnabled
                  ? "On"
                  : "Off"
                : "Unavailable"}
            </MetaItem>
            <MetaItem label="Joined">
              <StaffDate value={user.createdAt} withTime className="text-staff-fg" />
            </MetaItem>
          </>
        }
        secondaryActions={
          access.canManageRoles ? (
            <StaffButton variant="secondary" onClick={() => actions.changeRole(target)}>
              Change role
            </StaffButton>
          ) : null
        }
        overflow={<OverflowMenu label="More account actions" Link={NextLink} actions={overflow} />}
        access={canAct ? "full" : "read-only"}
        roleLabel="Accounts"
        notice={
          issues.length > 0 ? <IssueList items={issues} Link={NextLink} allClear={null} /> : null
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
      >
        <DetailColumns railLabel="Account context" rail={rail}>
          {tabs.find((tab) => tab.id === activeTab)?.content}
        </DetailColumns>
      </DetailPage>
      {actions.dialogs}
    </>
  );
}
