"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { TableScroll } from "@/components/ui/table-scroll";
import { formatDateTime } from "@/lib/ui/format";
import type { Bid } from "@auction/types";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

function columns(): ColumnDef<Bid>[] {
  return [
    {
      accessorKey: "amount",
      header: "Amount",
      meta: { numeric: true },
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.amount}
          {row.original.isWinning ? (
            <span className="ml-2 rounded bg-success/10 px-1.5 py-0.5 font-label text-[10px] uppercase text-success">
              Winning
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: ({ row }) => (
        <span className="text-on-surface-variant">
          {row.original.isAutoBid ? "Auto" : "Manual"}
        </span>
      ),
    },
    {
      id: "bidder",
      header: "Bidder",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-on-surface-variant">
          {(row.original.bidderId ?? "").slice(0, 12)}…
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Placed",
      cell: ({ row }) => (
        <span className="text-xs text-on-surface-variant">
          {formatDateTime(row.original.createdAt)}
        </span>
      ),
    },
  ];
}

export function AdminLotBidsTable({ bids }: { bids: Bid[] }) {
  const tableColumns = useMemo(() => columns(), []);

  if (bids.length === 0) {
    return (
      <AdminEmptyState
        title="No bids yet"
        description="Bids placed on this lot will appear here."
      />
    );
  }

  return (
    <TableScroll>
      <AdminDataTable
        ariaLabel="Lot bids"
        columns={tableColumns}
        data={bids}
        getRowId={(b) => b.id}
      />
    </TableScroll>
  );
}
