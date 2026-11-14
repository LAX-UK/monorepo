"use client";

import { filterChip, useWorkList } from "@/components/use-work-list.client";
import { createSavedViewsPort } from "@/lib/saved-views-port.client";
import { staffList, staffTeamViews } from "@/server/domain/people-lists.vm";
import {
  STAFF_ROLE_OPTIONS,
  type StaffMemberRow,
  bidStaffMemberHref,
  staffMemberName,
  staffRoleNames,
  staffRolePeriods,
} from "@/server/domain/staff-directory.vm";
import { staffRoleLabel, staffRolesLabel } from "@/server/domain/staff-role-label.vm";
import { staffStatus } from "@/server/domain/staff-status";
import type { WorkListState } from "@/server/domain/work-list.vm";
import type { AdminStaffMemberList } from "@auction/shop-contracts";
import {
  type DataColumn,
  DataViews,
  FilterSheet,
  ListPage,
  PersonCell,
  StackedCell,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
  StatusBadge,
  useSavedViews,
  useStaffCan,
} from "@auction/staff-ui";
import { ExternalLink } from "@auction/staff-ui/icons";
import { useMemo } from "react";

const STAFF_LIST_KEY = "lax-admin.staff";

type StaffState = WorkListState<"role">;

function accessOf(member: StaffMemberRow) {
  return staffStatus("staffAccess", member.disabledAt ? "disabled" : "active");
}

function rolesLabel(value: string): string {
  return value
    .split(",")
    .map((role) => staffRoleLabel(role))
    .join(", ");
}

/** The search and role filter as URL params, which is what a saved or team view holds. */
function filterQuery(state: StaffState): string {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.filters.role) params.set("role", state.filters.role);
  return params.toString();
}

const VIEW_EMPTY: Record<string, { title: string; description: string }> = {
  all: {
    title: "No staff yet",
    description: "People given a LAX Admin role in Bid admin appear here.",
  },
  active: {
    title: "No one can sign in",
    description: "Staff who can sign in to LAX Admin appear here.",
  },
  disabled: {
    title: "No one has had access removed",
    description: "When someone's last LAX Admin role ends they appear here.",
  },
};

/** Managing staff needs the LAX Admin settings capability, which only Administrators hold. */
const MANAGE_STAFF = "settings.write";

/** A link to manage staff in Bid admin, shown only to people who may manage staff. */
function ManageInBidAdmin({ href, size }: { href: string | undefined; size?: "sm" }) {
  if (!href) return null;
  return (
    <StaffButton
      asChild
      variant="secondary"
      {...(size ? { size } : {})}
      requires={MANAGE_STAFF}
      icon={<ExternalLink aria-hidden />}
    >
      <a href={href} target="_blank" rel="noreferrer">
        Manage in Bid admin
      </a>
    </StaffButton>
  );
}

/**
 * A staff member's name as a link to their page in Bid admin, where their roles are managed. It
 * opens in a new tab and says so: an arrow after the name and "opens Bid admin" to screen readers.
 */
const BidAdminLink: StaffLinkComponent = ({ href, children, className }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    title="Opens Bid admin in a new tab"
    className={className}
  >
    {children}
    <ExternalLink aria-hidden className="ml-1 inline size-3 align-[-1px] text-staff-muted" />
    <span className="sr-only"> (opens Bid admin)</span>
  </a>
);

/**
 * Who can sign in to LAX Admin, on the staff list template: views by access with counts, search
 * by name or email, a role filter (and team views by role), A to Z on the server and 50 a page.
 * Roles are given and removed in Bid admin, so this list only reads them: each row shows a
 * person's roles and any that end or have not started, and there is no panel. For those who
 * manage staff, the name links to the person's page in Bid admin.
 */
export function StaffList({
  state,
  page,
  currentSubject,
  bidStaffUrl,
  loadFailed = false,
}: {
  state: StaffState;
  page: AdminStaffMemberList;
  currentSubject: string;
  bidStaffUrl: string | undefined;
  loadFailed?: boolean;
}) {
  const list = useWorkList({
    list: staffList,
    state,
    page,
    noun: { one: "staff member", other: "staff members" },
    search: { label: "Search staff", placeholder: "Search by name or email" },
  });
  const port = useMemo(() => createSavedViewsPort(STAFF_LIST_KEY), []);
  const saved = useSavedViews(STAFF_LIST_KEY, port);
  const team = useMemo(() => staffTeamViews(), []);
  const canManage = useStaffCan(MANAGE_STAFF);
  const now = useMemo(() => new Date(), []);

  const columns = useMemo<DataColumn<StaffMemberRow>[]>(
    () => [
      {
        id: "name",
        header: "Staff member",
        mobile: "title",
        sortable: true,
        defaultSortDirection: "asc",
        cell: (row) => (
          <PersonCell
            name={staffMemberName(row)}
            secondary={
              row.identitySubjectId === currentSubject
                ? `You${row.email ? ` · ${row.email}` : ""}`
                : row.email && row.displayName
                  ? row.email
                  : null
            }
            {...(canManage ? { href: bidStaffMemberHref(bidStaffUrl, row) } : {})}
            Link={BidAdminLink}
          />
        ),
      },
      {
        id: "access",
        header: "Access",
        width: "152px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <StatusBadge tone={accessOf(row).tone}>{accessOf(row).label}</StatusBadge>,
      },
      {
        id: "role",
        header: "Roles",
        width: "240px",
        mobile: "meta",
        truncate: false,
        cell: (row) => (
          <StackedCell secondary={staffRolePeriods(row, now)}>
            <span className="whitespace-normal">{staffRolesLabel(staffRoleNames(row))}</span>
          </StackedCell>
        ),
      },
      {
        id: "lastActive",
        header: "Last active",
        width: "184px",
        hideBelow: "md",
        mobile: "meta",
        truncate: false,
        cell: (row) => (row.lastActiveAt ? <StaffDate value={row.lastActiveAt} withTime /> : null),
      },
      {
        id: "added",
        header: "Added",
        width: "136px",
        sortable: true,
        defaultSortDirection: "desc",
        hideBelow: "lg",
        mobile: "hidden",
        truncate: false,
        cell: (row) => <StaffDate value={row.createdAt} />,
      },
    ],
    [currentSubject, canManage, bidStaffUrl, now],
  );

  const roleChip = filterChip(staffList, state, list.navigate, "role", rolesLabel);
  const empty =
    VIEW_EMPTY[state.view] ?? (VIEW_EMPTY.all as { title: string; description: string });

  return (
    <>
      <ListPage<StaffMemberRow>
        title="Staff"
        description="Everyone who can sign in to LAX Admin, their roles and when they were last active. Roles are managed in Bid admin."
        Link={list.Link}
        listKey={STAFF_LIST_KEY}
        secondaryActions={<ManageInBidAdmin href={bidStaffUrl} size="sm" />}
        views={
          <DataViews
            views={staffList.views(state, page.counts)}
            activeId={state.view}
            Link={list.Link}
            team={team}
            saved={saved}
            savedHref={(view) => `${staffList.config.path}?${view.query}`}
            currentQuery={filterQuery(state)}
          />
        }
        search={list.search}
        filters={
          <FilterSheet
            title="Filter staff"
            sections={[
              {
                kind: "checklist",
                id: "role",
                label: "Role",
                options: STAFF_ROLE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                })),
                value: state.filters.role ? state.filters.role.split(",") : [],
              },
            ]}
            onApply={(values) => {
              const roles = values.role as readonly string[];
              list.navigate(staffList.href(state, { role: roles.length ? roles.join(",") : null }));
            }}
          />
        }
        activeFilters={[...list.searchChip, ...roleChip]}
        onClearFilters={list.clearFilters}
        loading={list.pending}
        filtered={list.filtered}
        error={
          loadFailed
            ? {
                title: "Staff did not load",
                description: "Something went wrong on our side. Try again in a moment.",
                onRetry: () => list.navigate(staffList.href(state)),
              }
            : null
        }
        empty={{ illustration: "plinth", ...empty }}
        noResults={{ noun: "staff" }}
        table={{
          columns,
          data: page.items,
          getRowId: (row) => row.staffMemberId,
          defaultDensity: "comfortable",
          ...list.sort,
        }}
        pageSize={list.pageSize}
        pagination={list.pagination}
      />
    </>
  );
}
