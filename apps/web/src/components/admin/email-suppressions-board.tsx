"use client";

import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { EmailSuppressionRemoveButton } from "@/components/admin/email-suppression-remove-button";
import { useTableDensity } from "@/components/layout/density-provider";
import { getEmailSuppressionBulkOperations } from "@/lib/admin/bulk-ops/email-suppressions";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import { DataTable } from "@auction/ui";
import { StatusBadge } from "@auction/ui/components/status-badge";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

export type EmailSuppressionRow = {
  emailHash: string;
  reason: "hard_bounce" | "complaint" | "manual" | "unsubscribe";
  createdAt: string;
};

function shortHash(value: string): string {
  return `${value.slice(0, 14)}...`;
}

function columns(): ColumnDef<EmailSuppressionRow>[] {
  return [
    {
      accessorKey: "emailHash",
      header: "Email hash",
      cell: ({ row }) => shortHash(row.original.emailHash),
    },
    {
      accessorKey: "reason",
      header: "Reason",
      cell: ({ row }) => (
        <StatusBadge variant={row.original.reason === "complaint" ? "danger" : "warning"}>
          {row.original.reason}
        </StatusBadge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Added",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => <EmailSuppressionRemoveButton emailHash={row.original.emailHash} />,
      enableSorting: false,
    },
  ];
}

export function EmailSuppressionsBoard({ rows }: { rows: EmailSuppressionRow[] }) {
  const { density } = useTableDensity();
  const { rowSelection, setRowSelection, selectedIds, clear } = useBulkSelection();
  const tableColumns = useMemo(() => columns(), []);
  const bulkOperations = useMemo(() => getEmailSuppressionBulkOperations(), []);

  return (
    <div className="space-y-4">
      <DataTable
        columns={tableColumns}
        data={rows}
        density={density}
        enableRowSelection
        getRowId={(row) => row.emailHash}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
      />
      <BulkActionsToolbar selectedIds={selectedIds} operations={bulkOperations} onClear={clear} />
    </div>
  );
}
