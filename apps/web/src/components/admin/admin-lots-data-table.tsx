"use client";

import { DataTable } from "@auction/ui/components/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";

export type AdminLotTableRow = {
  id: string;
  title: string;
  auctionType: string;
  status: string;
  endTimeLabel: string;
  currentPrice: string;
};

function lotColumns(): ColumnDef<AdminLotTableRow>[] {
  return [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <Link
          href={`/admin/lots/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      accessorKey: "auctionType",
      header: "Type",
      cell: ({ row }) => (
        <span className="text-on-surface-variant">{row.original.auctionType}</span>
      ),
    },
    { accessorKey: "status", header: "Status" },
    {
      accessorKey: "endTimeLabel",
      header: "Ends",
      cell: ({ row }) => (
        <span className="text-xs text-on-surface-variant">{row.original.endTimeLabel}</span>
      ),
    },
    {
      accessorKey: "currentPrice",
      header: () => <span className="block text-right">Hammer</span>,
      cell: ({ row }) => (
        <span className="block text-right tabular-nums">{row.original.currentPrice}</span>
      ),
    },
  ];
}

type Props = {
  rows: AdminLotTableRow[];
};

export function AdminLotsDataTable({ rows }: Props) {
  const columns = useMemo(() => lotColumns(), []);
  return <DataTable columns={columns} data={rows} emptyMessage="No auctions match this filter." />;
}
