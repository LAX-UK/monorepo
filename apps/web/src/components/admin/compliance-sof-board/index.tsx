"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { sofColumns } from "@/components/admin/compliance-sof-board/columns";
import { SofMobileCards } from "@/components/admin/compliance-sof-board/mobile-cards";
import { useTableDensity } from "@/components/layout/density-provider";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import { EntityList } from "@auction/ui";

type Props = {
  rows: AdminSofTableRow[];
};

export function ComplianceSofBoard({ rows }: Props) {
  const { density } = useTableDensity();
  const columns = sofColumns();

  return (
    <EntityList
      responsiveMode="auto"
      density={density}
      table={
        <AdminDataTable
          ariaLabel="Source of Funds cases pending review"
          columns={columns}
          data={rows}
          emptyMessage="No pending Source of Funds cases."
          density={density}
          getRowId={(r) => r.id}
          stickyFirstColumn
        />
      }
      cards={<SofMobileCards rows={rows} />}
    />
  );
}
