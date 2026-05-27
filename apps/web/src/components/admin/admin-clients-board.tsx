"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { UserSuspendAction } from "@/components/admin/admin-user-actions";
import { AdminUserAvatar } from "@/components/admin/admin-user-avatar";
import { AdminUserListShell } from "@/components/admin/admin-user-list-shell";
import {
  userJoinedColumn,
  userLastActivityColumn,
  userRowActionsColumn,
  userStatusColumn,
} from "@/components/admin/users-board";
import { FilterEmptyState } from "@/components/app/filter-empty-state";
import { getUserBulkOperations } from "@/lib/admin/bulk-ops/users";
import { formatAdminUserDate } from "@/lib/admin/format-admin-user-date";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
import { Button } from "@auction/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo } from "react";

function clientColumns(onOpen: (u: AdminUserRow) => void): ColumnDef<AdminUserRow>[] {
  return [
    {
      id: "identity",
      header: "Client",
      cell: ({ row }) => {
        const u = row.original;
        return <ClientIdentityCell u={u} onOpen={() => onOpen(u)} />;
      },
    },
    {
      id: "verification",
      header: "Verification",
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {u.emailVerified ? (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] text-success"
                title="Email verified"
              >
                <Check className="size-3" aria-hidden />
                Email
              </span>
            ) : (
              <span className="text-[10px] text-on-surface-variant">Email unverified</span>
            )}
            <AdminStatusBadge domain="kyc" status={u.kycStatus ?? ""} size="sm" />
          </div>
        );
      },
    },
    userStatusColumn(),
    userJoinedColumn(),
    userLastActivityColumn(),
    userRowActionsColumn(onOpen),
  ];
}

function ClientIdentityCell({ u, onOpen }: { u: AdminUserRow; onOpen: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <AdminUserAvatar user={u} size="sm" />
      <div className="min-w-0">
        <Button
          type="button"
          variant="link"
          className="block h-auto max-w-[14rem] truncate px-0 py-0 text-left text-sm font-medium text-primary underline-offset-2 hover:underline"
          onClick={onOpen}
        >
          {u.name}
        </Button>
        <p className="max-w-[14rem] truncate text-xs text-on-surface-variant">{u.email}</p>
      </div>
    </div>
  );
}

export function AdminClientMobileCard({ u, onOpen }: { u: AdminUserRow; onOpen: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="flex h-auto min-h-0 w-full items-center gap-3 rounded-sm border border-border-hairline bg-surface-container-lowest/80 p-4 text-left shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onClick={onOpen}
    >
      <AdminUserAvatar user={u} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-headline text-base text-on-surface">{u.name}</p>
        <p className="truncate text-xs text-on-surface-variant">{u.email}</p>
        <div className="mt-1 flex items-center gap-2">
          <AdminStatusBadge
            domain="user"
            status={u.suspendedAt ? "suspended" : "active"}
            size="sm"
          />
          <span className="text-[10px] text-on-surface-variant">
            Joined {formatAdminUserDate(u.createdAt)}
          </span>
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-on-surface-variant" aria-hidden />
    </Button>
  );
}

function ClientDrawerOverview({ u }: { u: AdminUserRow }) {
  return (
    <dl className="grid grid-cols-1 gap-3 text-sm">
      <div>
        <dt className="font-label text-[10px] uppercase text-on-surface-variant">Email</dt>
        <dd className="break-all">{u.email}</dd>
      </div>
      <div>
        <dt className="font-label text-[10px] uppercase text-on-surface-variant">User ID</dt>
        <dd className="break-all font-mono text-xs">{u.id}</dd>
      </div>
    </dl>
  );
}

function ClientDrawerActions({ u }: { u: AdminUserRow }) {
  return (
    <div className="space-y-4">
      <Button variant="secondary" className="w-full font-label uppercase" asChild>
        <Link href={`/admin/clients/${u.id}`}>Open full profile</Link>
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => void navigator.clipboard.writeText(u.id)}
      >
        Copy user ID
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => void navigator.clipboard.writeText(u.email)}
      >
        Copy email
      </Button>
      <UserSuspendAction userId={u.id} suspendedAt={u.suspendedAt} fullWidthButton />
    </div>
  );
}

type Props = {
  rows: AdminUserRow[];
  totalMatches: number;
};

export function AdminClientsBoard({ rows, totalMatches }: Props) {
  const bulkOperations = useMemo(() => getUserBulkOperations(), []);

  const renderDrawerOverview = useCallback((u: AdminUserRow) => <ClientDrawerOverview u={u} />, []);
  const renderDrawerActions = useCallback((u: AdminUserRow) => <ClientDrawerActions u={u} />, []);

  const renderMobileCard = useCallback(
    (u: AdminUserRow, onOpen: () => void) => <AdminClientMobileCard u={u} onOpen={onOpen} />,
    [],
  );

  return (
    <AdminUserListShell
      rows={rows}
      totalMatches={totalMatches}
      bulkOperations={bulkOperations}
      drawerTitle="Client"
      tableAriaLabel="Clients"
      emptyComponent={<FilterEmptyState entity="clients" segment="admin" hasActiveFilters />}
      renderDrawerOverview={renderDrawerOverview}
      renderDrawerActions={renderDrawerActions}
      renderMobileCard={renderMobileCard}
      buildColumns={clientColumns}
      detailHref={(u) => `/admin/clients/${u.id}`}
      showColumnPicker
      columnVisibilityStorageKey="admin.clients.columns"
    />
  );
}
