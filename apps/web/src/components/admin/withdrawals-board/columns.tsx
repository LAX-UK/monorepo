"use client";

import type { LotWithdrawalRequestTask } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";
import { Button } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

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
      cell: ({ row }) =>
        row.original.targetLotId ? (
          <Link
            href={`/admin/lots/${row.original.targetLotId}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            View lot
          </Link>
        ) : (
          <span className="text-on-surface-variant">—</span>
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
