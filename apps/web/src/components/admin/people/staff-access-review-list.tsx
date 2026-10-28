"use client";

import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import { downloadCsv } from "@/lib/admin/exports/download-csv";
import type { StaffAccessReviewPageModel } from "@/lib/admin/people/load-staff-access-review-page";
import {
  ACCESS_REVIEW_CSV_COLUMNS,
  type AccessReviewRowView,
  type AccessReviewSearch,
  accessReviewHref,
  accessReviewSort,
} from "@/lib/admin/people/staff-access-review.vm";
import { STAFF_ROLE_FILTERS } from "@/lib/admin/people/staff-directory-list.vm";
import { staffRoleLastDay } from "@/lib/admin/people/staff-roles.vm";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import { USER_ROLE_MANAGEMENT_ACCESS } from "@/lib/navigation/staff-nav-access";
import {
  CsvExportMenu,
  type DataColumn,
  DataViews,
  FilterSheet,
  ListPage,
  PersonCell,
  StaffDate,
  StatusBadge,
  TableSearch,
} from "@auction/staff-ui";
import { bidStaffRoleLabel } from "@auction/types";
import { useMemo } from "react";

type Props = { model: StaffAccessReviewPageModel; search: AccessReviewSearch };

const VIEW_EMPTY = {
  all: {
    title: "No staff yet",
    description: "Staff appear here with their roles once they accept an invitation.",
  },
  ending: {
    title: "No roles end in the next 30 days",
    description: "Roles given with a last day appear here a month before they end.",
  },
} as const;

/** Each role on its own line: its name, since when, and until when; ending soon in amber. */
function RolesCell({ row }: { row: AccessReviewRowView }) {
  if (row.roles.length === 0) {
    return <span className="text-staff-muted">No roles</span>;
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {row.roles.map((role) => (
        <li key={role.id} className="flex min-w-0 flex-col leading-snug">
          <span className="truncate font-medium text-staff-fg">{role.label}</span>
          <span
            className={
              role.endingSoon
                ? "truncate text-staff-xs font-medium text-staff-warning-fg"
                : "truncate text-staff-xs text-staff-muted"
            }
          >
            {role.meta}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The access review on the staff list template: every staff member with their Bid roles, since
 * when and until when, and their last sign-in. Views for everyone and for roles ending within 30
 * days, a role filter, search and a CSV export of what is shown. Read-only staff see the same
 * review without the export or links to records they cannot open.
 */
export function StaffAccessReviewList({ model, search }: Props) {
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const { filters, counts, rows } = model;

  const columns = useMemo<DataColumn<AccessReviewRowView>[]>(
    () => [
      {
        id: "name",
        header: "Staff member",
        mobile: "title",
        sortable: true,
        defaultSortDirection: "asc",
        width: "260px",
        cell: (row) => (
          <PersonCell
            name={row.name}
            secondary={row.email}
            href={row.href}
            {...(row.href ? { Link: ListLink } : {})}
          />
        ),
      },
      {
        id: "roles",
        header: "Roles",
        mobile: "meta",
        truncate: false,
        cell: (row) => <RolesCell row={row} />,
      },
      {
        id: "nextEnd",
        header: "Next role ends",
        width: "152px",
        sortable: true,
        defaultSortDirection: "asc",
        hideBelow: "md",
        mobile: "hidden",
        truncate: false,
        cell: (row) => (row.nextEnd ? staffRoleLastDay(row.nextEnd) : null),
      },
      {
        id: "lastSignIn",
        header: "Last sign-in",
        width: "184px",
        sortable: true,
        defaultSortDirection: "desc",
        hideBelow: "lg",
        mobile: "meta",
        truncate: false,
        // Stacked on a phone the column header is gone, so the line names itself.
        cell: (row) =>
          row.lastSignInAt ? (
            <span>
              <span className="md:hidden">Last sign-in </span>
              <StaffDate value={row.lastSignInAt} withTime />
            </span>
          ) : (
            <>
              <span className="md:hidden">Last sign-in not known</span>
              <span className="hidden md:inline">Not known</span>
            </>
          ),
      },
      {
        id: "account",
        header: "Account",
        width: "112px",
        hideBelow: "xl",
        mobile: "badge",
        truncate: false,
        cell: (row) => {
          const standing = staffStatus("user", row.suspended ? "suspended" : "active");
          return <StatusBadge tone={standing.tone}>{standing.label}</StatusBadge>;
        },
      },
    ],
    [ListLink],
  );

  const views = [
    { id: "all", label: "All staff", count: counts.all, view: null },
    { id: "ending", label: "Ending within 30 days", count: counts.ending, view: "ending" },
  ].map((view) => ({
    id: view.id,
    label: view.label,
    count: view.count,
    href: accessReviewHref(search, { view: view.view }),
  }));
  const filtered = filters.role !== null || filters.q !== "";

  return (
    <ListPage<AccessReviewRowView>
      title="Access review"
      description="Every staff member's Bid roles, when each started and ends, and when they last signed in."
      Link={ListLink}
      listKey="bid-admin.staff-access-review"
      editRequires={USER_ROLE_MANAGEMENT_ACCESS}
      exportAction={
        <CsvExportMenu
          noun="staff members"
          shown={rows.length}
          total={model.total}
          requires={USER_ROLE_MANAGEMENT_ACCESS}
          onExport={(scope) =>
            downloadCsv(
              `staff-access-review-${new Date().toISOString().slice(0, 10)}.csv`,
              ACCESS_REVIEW_CSV_COLUMNS,
              scope === "shown" ? model.csv.shown : model.csv.all,
            )
          }
        />
      }
      views={<DataViews views={views} activeId={filters.view} Link={ListLink} />}
      search={
        <TableSearch
          key={filters.q}
          fullWidth
          label="Search staff"
          placeholder="Search by name or email"
          value={filters.q}
          onSearch={(next) => navigate(accessReviewHref(search, { q: next || null }))}
        />
      }
      filters={
        <FilterSheet
          title="Filter staff"
          sections={[
            {
              kind: "radio",
              id: "role",
              label: "Role",
              anyLabel: "Any role",
              options: STAFF_ROLE_FILTERS,
              value: filters.role ?? "",
            },
          ]}
          onApply={(values) =>
            navigate(accessReviewHref(search, { role: (values.role as string) || null }))
          }
        />
      }
      activeFilters={
        filters.role
          ? [
              {
                id: "role",
                label: `Role: ${bidStaffRoleLabel(filters.role)}`,
                onRemove: () => navigate(accessReviewHref(search, { role: null })),
              },
            ]
          : []
      }
      onClearFilters={() => navigate(accessReviewHref(search, { role: null, q: null }))}
      loading={pending}
      filtered={filtered}
      error={
        model.loadError
          ? {
              title: "The access review did not load",
              description: model.loadError,
              onRetry: () => navigate(accessReviewHref(search, {})),
            }
          : null
      }
      empty={VIEW_EMPTY[filters.view]}
      noResults={{ noun: "staff" }}
      resultCount={`${rows.length} ${rows.length === 1 ? "staff member" : "staff members"}`}
      table={{
        columns,
        data: rows,
        getRowId: (row) => row.id,
        defaultDensity: "comfortable",
        defaultSort: accessReviewSort.defaultSort,
        sort: accessReviewSort.state(typeof search.sort === "string" ? search.sort : null),
        onSortChange: (sort) =>
          navigate(accessReviewHref(search, { sort: accessReviewSort.param(sort) })),
        rowActions: {
          label: (row) => `Actions for ${row.name}`,
          actions: (row) =>
            row.href
              ? [
                  { id: "open", label: "Open staff record", href: row.href },
                  {
                    id: "roles",
                    label: "Manage roles",
                    href: `${row.href}#roles`,
                    requires: USER_ROLE_MANAGEMENT_ACCESS,
                  },
                ]
              : [],
        },
      }}
    />
  );
}
