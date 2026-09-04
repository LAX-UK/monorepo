"use client";

import { UserStaffRoleAction, UserSuspendAction } from "@/components/admin/admin-user-actions";
import { AdminUserListShell } from "@/components/admin/admin-user-list-shell";
import { PeopleStaffMobileCard } from "@/components/admin/people/people-mobile-card";
import {
  userJoinedColumn,
  userRowActionsColumn,
  userStatusColumn,
} from "@/components/admin/users-board";
import { FilterEmptyState } from "@/components/app/filter-empty-state";
import { getUserBulkOperations } from "@/lib/admin/bulk-ops/users";
import { buildPeopleDetailHref } from "@/lib/admin/people/people-detail-href";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
import type { UserStaffRole } from "@auction/types";
import { Button } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useCallback, useMemo } from "react";

function staffColumns(onOpen: (u: AdminUserRow) => void): ColumnDef<AdminUserRow>[] {
  return [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="link"
          className="h-auto max-w-[12rem] truncate px-0 py-0 text-left font-medium text-link underline-offset-2 hover:underline"
          onClick={() => onOpen(row.original)}
        >
          {row.original.name}
        </Button>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="max-w-[14rem] truncate text-xs">{row.original.email}</span>
      ),
    },
    {
      id: "staffRole",
      header: "Staff role",
      cell: ({ row }) => (
        <span className="text-xs capitalize text-on-surface">
          {staffRoleLabel(row.original.staffRole as UserStaffRole | null)}
        </span>
      ),
    },
    userStatusColumn(),
    userJoinedColumn(),
    userRowActionsColumn(onOpen),
  ];
}

function StaffDrawerOverview({ u }: { u: AdminUserRow }) {
  return (
    <dl className="grid grid-cols-1 gap-3 text-sm">
      <div>
        <dt className="font-label text-[10px] uppercase text-on-surface-variant">Name</dt>
        <dd className="font-headline text-lg">{u.name}</dd>
      </div>
      <div>
        <dt className="font-label text-[10px] uppercase text-on-surface-variant">Email</dt>
        <dd className="break-all">{u.email}</dd>
      </div>
      <div>
        <dt className="font-label text-[10px] uppercase text-on-surface-variant">Staff role</dt>
        <dd className="capitalize">{staffRoleLabel(u.staffRole as UserStaffRole | null)}</dd>
      </div>
    </dl>
  );
}

function StaffDrawerActions({
  u,
  listReturnTarget,
}: {
  u: AdminUserRow;
  listReturnTarget?: string | undefined;
}) {
  return (
    <div className="space-y-4">
      <Button variant="secondary" className="w-full font-label uppercase" asChild>
        <Link href={buildPeopleDetailHref(`/admin/staff/${u.id}`, listReturnTarget)}>
          Open full profile
        </Link>
      </Button>
      <div className="space-y-4 border-t border-border-hairline pt-4">
        <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Internal staff role
        </p>
        <UserStaffRoleAction
          userId={u.id}
          defaultStaffRole={(u.staffRole as UserStaffRole | null) ?? null}
        />
      </div>
      <div className="border-t border-border-hairline pt-4">
        <UserSuspendAction userId={u.id} suspendedAt={u.suspendedAt} fullWidthButton />
      </div>
    </div>
  );
}

type Props = {
  rows: AdminUserRow[];
  totalMatches: number;
  hasActiveFilters: boolean;
  externalMobileCards?: boolean;
  selected?: AdminUserRow | null;
  listReturnTarget?: string | undefined;
  onOpen?: (user: AdminUserRow) => void;
  onCloseDrawer?: () => void;
};

export function AdminStaffBoard({
  rows,
  totalMatches,
  hasActiveFilters,
  externalMobileCards = false,
  selected = null,
  listReturnTarget,
  onOpen,
  onCloseDrawer,
}: Props) {
  const bulkOperations = useMemo(() => getUserBulkOperations(), []);

  const renderDrawerOverview = useCallback((u: AdminUserRow) => <StaffDrawerOverview u={u} />, []);
  const renderDrawerActions = useCallback(
    (u: AdminUserRow) => <StaffDrawerActions u={u} listReturnTarget={listReturnTarget} />,
    [listReturnTarget],
  );

  const renderMobileCard = useCallback(
    (u: AdminUserRow, onOpen: () => void) => (
      <PeopleStaffMobileCard
        user={u}
        onOpen={onOpen}
        roleLabel={staffRoleLabel(u.staffRole as UserStaffRole | null)}
      />
    ),
    [],
  );

  return (
    <AdminUserListShell
      rows={rows}
      totalMatches={totalMatches}
      bulkOperations={bulkOperations}
      drawerTitle="Staff member"
      boardTitle="Staff"
      tableAriaLabel="Staff directory"
      emptyComponent={
        <FilterEmptyState
          entity="staff"
          segment="admin"
          hasActiveFilters={hasActiveFilters}
          clearFiltersHref="/admin/staff"
        />
      }
      renderDrawerOverview={renderDrawerOverview}
      renderDrawerActions={renderDrawerActions}
      {...(externalMobileCards ? { externalMobileCards: true } : { renderMobileCard })}
      buildColumns={staffColumns}
      detailHref={(u) => `/admin/staff/${u.id}`}
      showColumnPicker
      columnVisibilityStorageKey="admin.staff.columns"
      {...(onOpen
        ? {
            selected,
            onOpen,
            ...(onCloseDrawer ? { onCloseDrawer } : {}),
          }
        : {})}
    />
  );
}
