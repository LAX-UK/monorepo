"use client";

import {
  type PersonActionTarget,
  usePersonActions,
} from "@/components/admin/people/use-person-actions";
import { StaffBulkOperations } from "@/components/admin/staff/staff-bulk-operations";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import { getUserBulkOperations } from "@/lib/admin/bulk-ops/users";
import {
  type StaffDirectoryRow,
  type StaffListSearch,
  staffListHref,
  staffRoleFilterChoices,
  staffSort,
} from "@/lib/admin/people/staff-directory-list.vm";
import { STAFF_ACCESS_REVIEW_ACCESS } from "@/lib/navigation/staff-nav-access";
import {
  type DataColumn,
  DataViews,
  FilterSheet,
  ListPage,
  PersonCell,
  StaffButton,
  StaffDate,
  StatusBadge,
  TableSearch,
} from "@auction/staff-ui";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export type StaffDirectoryListProps = {
  rows: StaffDirectoryRow[];
  search: StaffListSearch;
  counts: { total: number; active: number; suspended: number };
  /** How many people hold each role now, among the matches. */
  roleCounts: Readonly<Record<string, number>>;
  filterChips: Array<{ id: string; label: string; clearHref: string }>;
  pageSize: number;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  canModerate: boolean;
  canManageRoles: boolean;
  canInvite: boolean;
  loadError: string | null;
  filtered: boolean;
};

const str = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

export function staffActionTarget(row: StaffDirectoryRow): PersonActionTarget {
  return {
    id: row.id,
    name: row.name,
    role: "staff",
    staffRole: row.staffRole,
    suspended: row.suspended,
    twoFactorEnabled: row.twoFactor === true,
  };
}

function twoFactorLabel(value: boolean | null): string {
  if (value === null) return "Not known";
  return value ? "On" : "Off";
}

const VIEW_EMPTY: Record<string, { title: string; description: string }> = {
  all: {
    title: "No staff yet",
    description: "Invite a colleague and they appear here once they accept.",
  },
  active: {
    title: "No active staff",
    description: "Staff who can sign in to the staff tools appear here.",
  },
  suspended: {
    title: "No suspended staff",
    description: "When a staff account is suspended it appears here until it is unsuspended.",
  },
};

/**
 * The staff directory on the staff list template: views by account standing with counts,
 * search, a filter for staff role, server sorting (newest first by default), bulk suspend for
 * roles that may moderate. A row opens the staff member's page, remembering this list
 * (`?list=`) for its breadcrumb and record pager; Cmd-click, middle-click and Cmd+Enter open it in
 * a new tab. Every row's `…` menu holds the account actions, each confirmed first.
 */
export function StaffDirectoryList(props: StaffDirectoryListProps) {
  const { rows, search, filtered } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const person = usePersonActions({
    canModerate: props.canModerate,
    canManageRoles: props.canManageRoles,
  });
  const operations = useMemo(
    () => (props.canModerate ? getUserBulkOperations() : []),
    [props.canModerate],
  );
  const status = str(search.status) || (str(search.suspended) === "1" ? "suspended" : "");
  const q = str(search.q);

  const columns = useMemo<DataColumn<StaffDirectoryRow>[]>(
    () => [
      {
        id: "name",
        header: "Staff member",
        mobile: "title",
        sortable: true,
        defaultSortDirection: "asc",
        cell: (row) => (
          <PersonCell name={row.name} secondary={row.email} href={row.href} Link={ListLink} />
        ),
      },
      {
        id: "account",
        header: "Account",
        width: "132px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <StatusBadge tone={row.account.tone}>{row.account.label}</StatusBadge>,
      },
      {
        id: "staffRole",
        header: "Roles",
        width: "176px",
        mobile: "meta",
        cell: (row) => row.staffRoleLabel,
      },
      {
        id: "access",
        header: "LAX access",
        width: "152px",
        hideBelow: "lg",
        mobile: "hidden",
        // One line per row: the tools by name here, each tool's role on the staff page.
        cell: (row) =>
          row.access.length > 0
            ? row.access.map((label) => label.split(" · ")[0]).join(", ")
            : null,
      },
      {
        id: "twoFactor",
        header: "Two-step",
        width: "104px",
        hideBelow: "xl",
        mobile: "hidden",
        cell: (row) => twoFactorLabel(row.twoFactor),
      },
      {
        id: "lastSignIn",
        header: "Last sign-in",
        width: "176px",
        hideBelow: "md",
        mobile: "meta",
        truncate: false,
        cell: (row) => (row.lastSignInAt ? <StaffDate value={row.lastSignInAt} withTime /> : null),
      },
      {
        id: "joined",
        header: "Joined",
        width: "128px",
        sortable: true,
        defaultSortDirection: "desc",
        hideBelow: "lg",
        mobile: "hidden",
        truncate: false,
        cell: (row) => <StaffDate value={row.joinedAt} />,
      },
    ],
    [ListLink],
  );

  const views = [
    { id: "all", label: "All", status: null, count: props.counts.total },
    { id: "active", label: "Active", status: "active", count: props.counts.active },
    { id: "suspended", label: "Suspended", status: "suspended", count: props.counts.suspended },
  ].map((view) => ({
    id: view.id,
    label: view.label,
    href: staffListHref(search, { status: view.status }),
    count: view.count,
  }));
  const activeView = status || "all";

  return (
    <>
      <ListPage<StaffDirectoryRow>
        title="Staff"
        description="Everyone who works in the staff tools, their roles and the LAX tools they can use."
        secondaryActions={
          <StaffButton asChild variant="secondary" size="sm" requires={STAFF_ACCESS_REVIEW_ACCESS}>
            <Link href="/admin/staff/access">Access review</Link>
          </StaffButton>
        }
        Link={ListLink}
        listKey="bid-admin.staff"
        primaryAction={
          props.canInvite ? (
            <StaffButton asChild variant="primary" size="sm" icon={<Plus aria-hidden />}>
              <Link href="/admin/invitations?invite=staff">Invite staff</Link>
            </StaffButton>
          ) : null
        }
        views={<DataViews views={views} activeId={activeView} Link={ListLink} />}
        search={
          <TableSearch
            key={q}
            fullWidth
            label="Search staff"
            placeholder="Search by name or email"
            value={q}
            onSearch={(next) => navigate(staffListHref(search, { q: next || null }))}
          />
        }
        filters={
          <FilterSheet
            title="Filter staff"
            sections={[
              {
                kind: "radio",
                id: "staffRole",
                label: "Staff role",
                anyLabel: "Any staff role",
                options: staffRoleFilterChoices(props.roleCounts),
                value: str(search.staffRole),
              },
            ]}
            onApply={(values) =>
              navigate(staffListHref(search, { staffRole: (values.staffRole as string) || null }))
            }
          />
        }
        activeFilters={props.filterChips.map((chip) => ({
          id: chip.id,
          label: chip.label,
          onRemove: () => navigate(chip.clearHref),
        }))}
        onClearFilters={() => navigate(staffListHref(search, { q: null, staffRole: null }))}
        loading={pending}
        filtered={filtered}
        error={
          props.loadError
            ? {
                title: "Staff did not load",
                description: props.loadError,
                onRetry: () => navigate(staffListHref(search, {})),
              }
            : null
        }
        empty={VIEW_EMPTY[activeView] ?? (VIEW_EMPTY.all as { title: string; description: string })}
        noResults={{ noun: "staff" }}
        table={{
          columns,
          data: rows,
          getRowId: (row) => row.id,
          defaultDensity: "comfortable",
          defaultHiddenColumns: ["joined"],
          defaultSort: staffSort.defaultSort,
          sort: staffSort.state(str(search.sort)),
          onSortChange: (sort) => navigate(staffListHref(search, { sort: staffSort.param(sort) })),
          rowHref: (row) => row.href,
          ...(operations.length > 0
            ? {
                selectedIds: selected,
                onSelectedIdsChange: setSelected,
                bulkNoun: { one: "staff member", other: "staff members" },
                bulkActions: (chosen: StaffDirectoryRow[]) => (
                  <StaffBulkOperations
                    operations={operations}
                    selectedIds={chosen.map((row) => row.id)}
                    onClear={() => setSelected(new Set())}
                    noun={{ one: "staff member", other: "staff members" }}
                  />
                ),
              }
            : {}),
          rowActions: {
            label: (row) => `Actions for ${row.name}`,
            actions: (row) => person.actionsFor(staffActionTarget(row)),
          },
        }}
        pageSize={{
          value: props.pageSize,
          onChange: (size) => navigate(staffListHref(search, { limit: size })),
        }}
        pagination={props.pagination}
      />
      {person.dialogs}
    </>
  );
}
