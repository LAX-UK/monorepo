"use client";

import { DataTable } from "@auction/ui/components/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";

export type AdminSaleTableRow = {
  saleId: string;
  title: string;
  status: string;
  lotCount: number;
};

function saleColumns(): ColumnDef<AdminSaleTableRow>[] {
  return [
    {
      accessorKey: "title",
      header: "Sale",
      cell: ({ row }) => (
        <p className="font-headline text-base text-on-surface">{row.original.title}</p>
      ),
    },
    {
      id: "meta",
      header: "Summary",
      accessorFn: (r) => `${r.status}-${r.lotCount}`,
      cell: ({ row }) => (
        <p className="font-label text-xs uppercase tracking-widest text-secondary">
          {row.original.status} · {row.original.lotCount} lot
          {row.original.lotCount === 1 ? "" : "s"}
        </p>
      ),
      enableSorting: false,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex flex-wrap justify-end gap-3">
          <Link
            href={`/admin/sales/${row.original.saleId}`}
            className="font-label text-xs font-bold uppercase tracking-widest text-primary underline-offset-4 hover:underline"
          >
            Manage
          </Link>
          <Link
            href={`/sales/${row.original.saleId}`}
            className="font-label text-xs font-bold uppercase tracking-widest text-secondary underline-offset-4 hover:underline"
          >
            View on site
          </Link>
        </div>
      ),
      enableSorting: false,
    },
  ];
}

type Props = {
  rows: AdminSaleTableRow[];
};

export function AdminSalesDataTable({ rows }: Props) {
  const columns = useMemo(() => saleColumns(), []);
  return <DataTable columns={columns} data={rows} emptyMessage="No sales found." />;
}
