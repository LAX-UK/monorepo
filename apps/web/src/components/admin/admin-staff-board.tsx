"use client";

import { UserStaffRoleAction, UserSuspendAction } from "@/components/admin/admin-user-actions";
import { AdminUserListShell } from "@/components/admin/admin-user-list-shell";
import {
  userJoinedColumn,
  userLastActivityColumn,
  userRowActionsColumn,
  userStatusColumn,
} from "@/components/admin/users-board";
import { getUserBulkOperations } from "@/lib/admin/bulk-ops/users";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
import type { UserStaffRole } from "@auction/types";
import { Button } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { type ReactNode, useCallback, useMemo } from "react";

function staffColumns(onOpen: (u: AdminUserRow) => void): ColumnDef<AdminUserRow>[] {
  return [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="link"
          className="h-auto max-w-[12rem] truncate px-0 py-0 text-left font-medium text-primary underline-offset-2 hover:underline"
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
    userLastActivityColumn("Last login"),
    userRowActionsColumn(onOpen),
  ];
}

function StaffDrawerContent({ u }: { u: AdminUserRow }) {
  return (
    <div className="space-y-6">
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
        <Button variant="secondary" className="w-full font-label uppercase" asChild>
          <Link href={`/admin/staff/${u.id}`}>Open full profile</Link>
        </Button>
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
  roleBreakdown?: ReactNode;
};

export function AdminStaffBoard({ rows, totalMatches, roleBreakdown }: Props) {
  const bulkOperations = useMemo(() => getUserBulkOperations(), []);

  const renderDrawerOverview = useCallback((u: AdminUserRow) => <StaffDrawerContent u={u} />, []);

  const renderMobileCard = useCallback(
    (u: AdminUserRow, onOpen: () => void) => (
      <div className="rounded-sm border border-border-hairline bg-surface-container-lowest/80 p-4">
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-full flex-col items-start justify-start rounded-none px-0 py-0 text-left hover:bg-transparent"
          onClick={onOpen}
        >
          <p className="font-headline text-base text-on-surface">{u.name}</p>
          <p className="mt-1 truncate text-xs text-on-surface-variant">{u.email}</p>
          <p className="mt-2 font-label text-[10px] uppercase text-secondary">
            {staffRoleLabel(u.staffRole as UserStaffRole | null)} ·{" "}
            {u.suspendedAt ? "Suspended" : "Active"}
          </p>
        </Button>
      </div>
    ),
    [],
  );

  return (
    <>
      {roleBreakdown}
      <AdminUserListShell
        rows={rows}
        totalMatches={totalMatches}
        bulkOperations={bulkOperations}
        drawerTitle="Staff member"
        tableAriaLabel="Staff directory"
        emptyMessage="No staff match this filter."
        renderDrawerOverview={renderDrawerOverview}
        renderMobileCard={renderMobileCard}
        buildColumns={staffColumns}
        detailHref={(u) => `/admin/staff/${u.id}`}
        showColumnPicker
        columnVisibilityStorageKey="admin.staff.columns"
      />
    </>
  );
}
