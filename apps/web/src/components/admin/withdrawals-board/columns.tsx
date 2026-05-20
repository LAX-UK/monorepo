"use client";

import type { LotWithdrawalRequestTask } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";
import { Button } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";

export function withdrawalColumns(
  onOpen: (row: LotWithdrawalRequestTask) => void,
): ColumnDef<LotWithdrawalRequestTask>[] {
  return [
    {
      accessorKey: "kind",
      header: "Kind",
      cell: ({ row }) => (
        <span className="font-label text-[10px] uppercase tracking-wide text-secondary">
          {row.original.kind.replaceAll("_", " ")}
        </span>
      ),
    },
    {
      id: "lot",
      header: "Lot",
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.targetLotId ? `${row.original.targetLotId.slice(0, 8)}…` : "—"}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Submitted",
      cell: ({ row }) => (
        <span className="text-xs text-on-surface-variant">
          {formatDateTime(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: "open",
      header: "",
      cell: ({ row }) => (
        <Button type="button" variant="secondary" size="sm" onClick={() => onOpen(row.original)}>
          Review
        </Button>
      ),
      enableSorting: false,
    },
  ];
}
