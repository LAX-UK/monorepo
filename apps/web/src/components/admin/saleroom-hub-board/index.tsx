"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { saleroomHubColumns } from "@/components/admin/saleroom-hub-board/columns";
import { useTableDensity } from "@/components/layout/density-provider";
import type { AdminSaleListRow } from "@/lib/data/http/admin.server";
import { EntityList } from "@auction/ui";
import Link from "next/link";
import { useMemo } from "react";

export function AdminSaleroomHubBoard({ rows }: { rows: AdminSaleListRow[] }) {
  const { density } = useTableDensity();
  const columns = useMemo(() => saleroomHubColumns(), []);

  return (
    <EntityList
      responsiveMode="auto"
      density={density}
      table={
        <AdminDataTable
          ariaLabel="Saleroom sales"
          columns={columns}
          data={rows}
          emptyMessage="No live or upcoming sales."
          density={density}
          getRowId={(r) => r.sale.id}
        />
      }
      cards={
        <ul className="divide-y divide-border-hairline rounded-lg border border-border-hairline">
          {rows.map((row) => (
            <li key={row.sale.id} className="p-4">
              <Link
                href={`/admin/saleroom/${row.sale.id}`}
                className="font-medium text-primary hover:underline"
              >
                {row.sale.title}
              </Link>
            </li>
          ))}
        </ul>
      }
    />
  );
}
