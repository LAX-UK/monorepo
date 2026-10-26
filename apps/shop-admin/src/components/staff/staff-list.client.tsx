"use client";

import { AddStaffDialog } from "@/components/staff/add-staff-dialog.client";
import { useStaffActions } from "@/components/staff/use-staff-actions.client";
import { filterChip, useWorkList } from "@/components/use-work-list.client";
import { createSavedViewsPort } from "@/lib/saved-views-port.client";
import { staffList, staffTeamViews } from "@/server/domain/people-lists.vm";
import {
  STAFF_ROLE_OPTIONS,
  type StaffMemberRow,
  staffMemberName,
  staffRoleAllows,
} from "@/server/domain/staff-directory.vm";
import { staffRoleLabel } from "@/server/domain/staff-role-label.vm";
import { staffStatus } from "@/server/domain/staff-status";
import type { WorkListState } from "@/server/domain/work-list.vm";
import type { AdminStaffMemberList } from "@auction/shop-contracts";
import {
  type DataColumn,
  DataViews,
  DetailPanel,
  FilterSheet,
  ListPage,
  OverflowMenu,
  PersonCell,
  StaffButton,
  StaffDate,
  StatusBadge,
  formatStaffDateTime,
  useSavedViews,
} from "@auction/staff-ui";
import { PanelRight, UserPlus } from "@auction/staff-ui/icons";
import { useMemo, useState } from "react";

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
    description: "Add the first person with a LAX login to give them access to LAX Admin.",
  },
  active: {
    title: "No one can sign in",
    description: "Staff who can sign in to LAX Admin appear here.",
  },
  disabled: {
    title: "No one has had access removed",
    description: "When someone's access is removed they appear here, and can be given it again.",
  },
};

/**
 * Who can sign in to LAX Admin, on the staff list template: views by access with counts, search
 * by name or email, a role filter (and team views by role), A to Z on the server, 50 a
 * page, and a record panel linked from the URL (`?staff=`). Every row's "…" menu changes the
 * role, removes access with a reason or gives it back, each confirmed first.
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
  const staff = useStaffActions({ currentSubject });
  const [adding, setAdding] = useState(false);
  const port = useMemo(() => createSavedViewsPort(STAFF_LIST_KEY), []);
  const saved = useSavedViews(STAFF_LIST_KEY, port);
  const team = useMemo(() => staffTeamViews(), []);
  const opened = page.items.find((row) => row.staffMemberId === list.panel.openId) ?? null;

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
            href={list.panelHref(row.staffMemberId)}
            Link={list.panel.PanelLink}
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
        header: "Role",
        width: "176px",
        mobile: "meta",
        cell: (row) => staffRoleLabel(row.role),
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
    [currentSubject, list.panelHref, list.panel.PanelLink],
  );

  const roleChip = filterChip(staffList, state, list.navigate, "role", rolesLabel);
  const empty =
    VIEW_EMPTY[state.view] ?? (VIEW_EMPTY.all as { title: string; description: string });
  const openedActions = opened ? staff.actionsFor(opened) : [];
  const isSelf = opened?.identitySubjectId === currentSubject;

  return (
    <>
      <ListPage<StaffMemberRow>
        title="Staff"
        description="Everyone who can sign in to LAX Admin, their role and when they were last active."
        Link={list.Link}
        listKey={STAFF_LIST_KEY}
        primaryAction={
          <StaffButton
            variant="primary"
            size="sm"
            icon={<UserPlus aria-hidden />}
            onClick={() => setAdding(true)}
          >
            Add staff
          </StaffButton>
        }
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
        noResults={{
          title: "No staff match",
          description: "Try another name, email or role, or clear the filters.",
        }}
        table={{
          columns,
          data: page.items,
          getRowId: (row) => row.staffMemberId,
          defaultDensity: "comfortable",
          ...list.sort,
          onRowOpen: (row) => list.panel.show(row.staffMemberId),
          activeRowId: list.panel.openId,
          rowActions: {
            label: (row) => `Actions for ${staffMemberName(row)}`,
            actions: (row) => [
              {
                id: "open",
                label: "Open details",
                icon: PanelRight,
                onSelect: () => list.panel.show(row.staffMemberId),
              },
              ...staff.actionsFor(row),
            ],
          },
        }}
        pageSize={list.pageSize}
        pagination={list.pagination}
      />

      <DetailPanel
        open={opened !== null}
        onOpenChange={(open) => {
          if (!open) list.panel.show(null);
        }}
        title={opened ? staffMemberName(opened) : "Staff member"}
        status={
          opened ? (
            <>
              <StatusBadge tone={accessOf(opened).tone}>{accessOf(opened).label}</StatusBadge>
              <StatusBadge tone="neutral">{staffRoleLabel(opened.role)}</StatusBadge>
            </>
          ) : null
        }
        meta={
          opened
            ? [
                {
                  label: "Last active",
                  value: opened.lastActiveAt
                    ? formatStaffDateTime(opened.lastActiveAt, { zoneLabel: true })
                    : "No activity yet",
                },
              ]
            : []
        }
        overflow={
          opened && openedActions.length > 0 ? (
            <OverflowMenu
              label={`Access actions for ${staffMemberName(opened)}`}
              actions={openedActions}
            />
          ) : null
        }
        summary={
          opened
            ? [
                ...(opened.email
                  ? [{ label: "Email", value: opened.email, copyValue: opened.email }]
                  : []),
                ...(staffRoleAllows(opened.role)
                  ? [{ label: "Can see and do", value: staffRoleAllows(opened.role) }]
                  : []),
                {
                  label: "Added",
                  value: formatStaffDateTime(opened.createdAt, { zoneLabel: true }),
                },
                ...(opened.disabledAt
                  ? [
                      {
                        label: "Access removed",
                        value: formatStaffDateTime(opened.disabledAt, { zoneLabel: true }),
                      },
                    ]
                  : []),
                {
                  label: "LAX account ID",
                  value: opened.identitySubjectId,
                  copyValue: opened.identitySubjectId,
                },
              ]
            : []
        }
        footer={
          opened && !isSelf ? (
            opened.disabledAt ? (
              <StaffButton
                variant="primary"
                onClick={() => staff.open({ kind: "restore", member: opened })}
              >
                Give access again
              </StaffButton>
            ) : (
              <StaffButton
                variant="secondary"
                onClick={() => staff.open({ kind: "role", member: opened })}
              >
                Change role
              </StaffButton>
            )
          ) : null
        }
      >
        {null}
      </DetailPanel>

      {staff.dialogs}
      <AddStaffDialog open={adding} onOpenChange={setAdding} bidStaffUrl={bidStaffUrl} />
    </>
  );
}
