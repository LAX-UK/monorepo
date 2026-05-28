"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { InvitationExpiryCountdown } from "@/components/admin/invitation-expiry-countdown";
import { InvitationRevokeButton } from "@/components/admin/invitation-revoke-button";
import { useTableDensity } from "@/components/layout/density-provider";
import { adminResendInvitationAction } from "@/lib/actions/admin";
import { getInvitationBulkOperations } from "@/lib/admin/bulk-ops/invitations";
import {
  invitationCanResendOrRevoke,
  invitationLifecycleDisplay,
} from "@/lib/admin/invite-lifecycle";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import type { AdminInvitationSummary } from "@/lib/data/http/invitations.server";
import type { UserRole } from "@auction/types";
import { Button, EntityList } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

function roleLabel(r: UserRole): string {
  if (r === "staff") return "Staff";
  return "Client";
}

function coerceDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

function columns(): ColumnDef<AdminInvitationSummary>[] {
  return [
    { accessorKey: "email", header: "Email" },
    {
      accessorKey: "targetRole",
      header: "Role",
      cell: ({ row }) => roleLabel(row.original.targetRole),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const r = row.original;
        const expiresAt = coerceDate(r.expiresAt);
        const openedAt = r.openedAt ? coerceDate(r.openedAt) : null;
        const display = invitationLifecycleDisplay({
          status: r.status,
          expiresAt,
          openedAt,
          inviteEmailLastStatus: r.inviteEmailLastStatus,
        });
        if (display.kind === "revoked") {
          return <AdminStatusBadge domain="invitation" status="revoked" />;
        }
        return <AdminStatusBadge domain="inviteLifecycle" status={display.pill} size="sm" />;
      },
      enableSorting: false,
    },
    {
      id: "expires",
      header: "Expires",
      cell: ({ row }) => {
        const expiresAt = coerceDate(row.original.expiresAt);
        const terminal = row.original.status !== "pending" || expiresAt.getTime() <= Date.now();
        return <InvitationExpiryCountdown expiresAt={expiresAt} active={!terminal} />;
      },
      enableSorting: false,
    },
    {
      id: "actions",
      header: () => <span className="block text-right">Actions</span>,
      cell: ({ row }) => {
        const r = row.original;
        const expiresAt = coerceDate(r.expiresAt);
        const canMutate = invitationCanResendOrRevoke({
          status: r.status,
          expiresAt,
          openedAt: r.openedAt ? coerceDate(r.openedAt) : null,
          inviteEmailLastStatus: r.inviteEmailLastStatus,
        });

        return (
          <div className="flex justify-end gap-2">
            <form action={adminResendInvitationAction}>
              <input type="hidden" name="invitationId" value={r.id} />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={!canMutate}
                className="font-label text-[10px] uppercase"
              >
                Resend
              </Button>
            </form>
            <InvitationRevokeButton invitationId={r.id} disabled={!canMutate} />
          </div>
        );
      },
      enableSorting: false,
    },
  ];
}

export function AdminInvitationsBoard({ rows }: { rows: AdminInvitationSummary[] }) {
  const { density } = useTableDensity();
  const { rowSelection, setRowSelection, selectedIds, clear } = useBulkSelection();
  const tableColumns = useMemo(() => columns(), []);
  const bulkOperations = useMemo(() => getInvitationBulkOperations(), []);

  const cards = (
    <ul className="space-y-3 lg:hidden">
      {rows.map((r) => {
        const expiresAt = coerceDate(r.expiresAt);
        const openedAt = r.openedAt ? coerceDate(r.openedAt) : null;
        const display = invitationLifecycleDisplay({
          status: r.status,
          expiresAt,
          openedAt,
          inviteEmailLastStatus: r.inviteEmailLastStatus,
        });
        const canMutate = invitationCanResendOrRevoke({
          status: r.status,
          expiresAt,
          openedAt,
          inviteEmailLastStatus: r.inviteEmailLastStatus,
        });
        return (
          <li
            key={r.id}
            className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-4"
          >
            <p className="truncate font-medium text-on-surface">{r.email}</p>
            <p className="mt-1 text-xs text-on-surface-variant">{roleLabel(r.targetRole)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {display.kind === "revoked" ? (
                <AdminStatusBadge domain="invitation" status="revoked" />
              ) : (
                <AdminStatusBadge domain="inviteLifecycle" status={display.pill} size="sm" />
              )}
              <InvitationExpiryCountdown
                expiresAt={expiresAt}
                active={r.status === "pending" && expiresAt.getTime() > Date.now()}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={adminResendInvitationAction}>
                <input type="hidden" name="invitationId" value={r.id} />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={!canMutate}
                  className="font-label text-[10px] uppercase"
                >
                  Resend
                </Button>
              </form>
              <InvitationRevokeButton invitationId={r.id} disabled={!canMutate} />
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="space-y-4">
      <EntityList
        responsiveMode="auto"
        density={density}
        table={
          <AdminDataTable
            ariaLabel="Invitations"
            columns={tableColumns}
            data={rows}
            density={density}
            enableRowSelection
            getRowId={(row) => row.id}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
          />
        }
        cards={cards}
      />
      <BulkActionsToolbar selectedIds={selectedIds} operations={bulkOperations} onClear={clear} />
    </div>
  );
}
