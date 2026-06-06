"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { saleroomHubColumns } from "@/components/admin/saleroom-hub-board/columns";
import { SaleroomHubMobileCards } from "@/components/admin/saleroom-hub-board/mobile-cards";
import { useTableDensity } from "@/components/layout/density-provider";
import type { AdminSaleListRow } from "@/lib/data/http/admin.server";
import { EntityList } from "@auction/ui";
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
      cards={<SaleroomHubMobileCards rows={rows} />}
    />
  );
}
