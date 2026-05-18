"use client";

import { UserSuspendAction } from "@/components/admin/admin-user-actions";
import { AdminUserAvatar } from "@/components/admin/admin-user-avatar";
import {
  type AdminUserListKpi,
  AdminUserListShell,
} from "@/components/admin/admin-user-list-shell";
import { getUserBulkOperations } from "@/lib/admin/bulk-ops/users";
import { formatAdminUserDate } from "@/lib/admin/format-admin-user-date";
import { kycStatusBadgeVariant, kycStatusLabel } from "@/lib/admin/kyc-status-presenter";
import { relativeFromIso } from "@/lib/admin/relative-time";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
import { Button, InlineActionMenu, StatusBadge } from "@auction/ui";
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
        return (
          <div className="flex items-center gap-3">
            <AdminUserAvatar user={u} size="sm" />
            <div className="min-w-0">
              <Button
                type="button"
                variant="link"
                className="block h-auto max-w-[14rem] truncate px-0 py-0 text-left text-sm font-medium text-primary underline-offset-2 hover:underline"
                onClick={() => onOpen(u)}
              >
                {u.name}
              </Button>
              <p className="max-w-[14rem] truncate text-xs text-on-surface-variant">{u.email}</p>
            </div>
          </div>
        );
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
            <StatusBadge variant={kycStatusBadgeVariant(u.kycStatus)} size="sm">
              {kycStatusLabel(u.kycStatus)}
            </StatusBadge>
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge variant={row.original.suspendedAt ? "danger" : "success"}>
          {row.original.suspendedAt ? "Suspended" : "Active"}
        </StatusBadge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Joined",
      cell: ({ row }) => (
        <span className="text-xs text-on-surface-variant">
          {formatAdminUserDate(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: "lastActivity",
      header: "Last activity",
      cell: ({ row }) => (
        <span className="text-xs text-on-surface-variant">
          {relativeFromIso(row.original.updatedAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="flex justify-end">
            <InlineActionMenu
              label={`Actions for ${u.name}`}
              items={[
                { type: "item", label: "Open details", onSelect: () => onOpen(u) },
                {
                  type: "item",
                  label: "Copy user ID",
                  onSelect: () => void navigator.clipboard.writeText(u.id),
                },
              ]}
            />
          </div>
        );
      },
      enableSorting: false,
    },
  ];
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
        <dd className="font-mono text-xs break-all">{u.id}</dd>
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
  kpis: AdminUserListKpi[];
};

export function AdminClientsBoard({ rows, totalMatches, kpis }: Props) {
  const bulkOperations = useMemo(() => getUserBulkOperations(), []);

  const renderDrawerOverview = useCallback((u: AdminUserRow) => <ClientDrawerOverview u={u} />, []);
  const renderDrawerActions = useCallback((u: AdminUserRow) => <ClientDrawerActions u={u} />, []);

  const renderMobileCard = useCallback(
    (u: AdminUserRow, onOpen: () => void) => (
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-sm border border-border-hairline bg-surface-container-lowest/80 p-4 text-left"
        onClick={onOpen}
      >
        <AdminUserAvatar user={u} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-headline text-base text-on-surface">{u.name}</p>
          <p className="truncate text-xs text-on-surface-variant">{u.email}</p>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge variant={u.suspendedAt ? "danger" : "success"} size="sm">
              {u.suspendedAt ? "Suspended" : "Active"}
            </StatusBadge>
            <span className="text-[10px] text-on-surface-variant">
              Joined {formatAdminUserDate(u.createdAt)}
            </span>
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-on-surface-variant" aria-hidden />
      </button>
    ),
    [],
  );

  return (
    <AdminUserListShell
      rows={rows}
      totalMatches={totalMatches}
      kpis={kpis}
      bulkOperations={bulkOperations}
      drawerTitle="Client"
      renderDrawerOverview={renderDrawerOverview}
      renderDrawerActions={renderDrawerActions}
      renderMobileCard={renderMobileCard}
      buildColumns={clientColumns}
    />
  );
}
