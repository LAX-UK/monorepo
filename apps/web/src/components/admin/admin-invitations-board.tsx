"use client";

import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { useTableDensity } from "@/components/layout/density-provider";
import { adminResendInvitationAction, adminRevokeInvitationAction } from "@/lib/actions/admin";
import { getInvitationBulkOperations } from "@/lib/admin/bulk-ops/invitations";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import type { AdminInvitationSummary } from "@/lib/data/http/invitations.server";
import type { UserRole } from "@auction/types";
import { Button, DataTable } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

function roleLabel(r: UserRole): string {
  if (r === "staff") return "Staff";
  return "Client";
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
      accessorKey: "expiresAt",
      header: "Expires",
      cell: ({ row }) => row.original.expiresAt.toLocaleString(),
    },
    {
      id: "actions",
      header: () => <span className="block text-right">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <form action={adminResendInvitationAction}>
            <input type="hidden" name="invitationId" value={row.original.id} />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="font-label text-[10px] uppercase"
            >
              Resend
            </Button>
          </form>
          <form action={adminRevokeInvitationAction}>
            <input type="hidden" name="invitationId" value={row.original.id} />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="font-label text-[10px] uppercase"
            >
              Revoke
            </Button>
          </form>
        </div>
      ),
      enableSorting: false,
    },
  ];
}

export function AdminInvitationsBoard({ rows }: { rows: AdminInvitationSummary[] }) {
  const { density } = useTableDensity();
  const { rowSelection, setRowSelection, selectedIds, clear } = useBulkSelection();
  const tableColumns = useMemo(() => columns(), []);
  const bulkOperations = useMemo(() => getInvitationBulkOperations(), []);

  return (
    <div className="space-y-4">
      <DataTable
        columns={tableColumns}
        data={rows}
        density={density}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
      />
      <BulkActionsToolbar selectedIds={selectedIds} operations={bulkOperations} onClear={clear} />
    </div>
  );
}
