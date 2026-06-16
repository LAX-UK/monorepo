"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { sofColumns, sofTableAriaLabel } from "@/components/admin/compliance-sof-board/columns";
import { SofMobileCards } from "@/components/admin/compliance-sof-board/mobile-cards";
import { useTableDensity } from "@/components/layout/density-provider";
import type { SofListStatus } from "@/lib/admin/sof-list-query";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import { EntityList } from "@auction/ui";
import { useMemo } from "react";

type Props = {
  rows: AdminSofTableRow[];
  status: SofListStatus;
  canReopen: boolean;
};

export function ComplianceSofBoard({ rows, status, canReopen }: Props) {
  const { density } = useTableDensity();
  const columns = useMemo(() => sofColumns({ status, canReopen }), [status, canReopen]);
  const emptyMessage =
    status === "pending"
      ? "No pending Source of Funds cases."
      : status === "rejected"
        ? "No rejected Source of Funds cases."
        : "No approved Source of Funds cases.";

  return (
    <EntityList
      responsiveMode="auto"
      density={density}
      table={
        <AdminDataTable
          ariaLabel={sofTableAriaLabel(status)}
          columns={columns}
          data={rows}
          emptyMessage={emptyMessage}
          density={density}
          getRowId={(r) => r.id}
          stickyFirstColumn
        />
      }
      cards={<SofMobileCards rows={rows} status={status} canReopen={canReopen} />}
    />
  );
}
