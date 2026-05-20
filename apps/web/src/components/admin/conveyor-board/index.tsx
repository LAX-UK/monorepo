"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { conveyorColumns } from "@/components/admin/conveyor-board/columns";
import { useTableDensity } from "@/components/layout/density-provider";
import type { AdminConveyorPipelineRow } from "@/lib/data/http/admin.server";
import { EntityList } from "@auction/ui";
import { useMemo } from "react";

export function AdminConveyorTableBoard({ rows }: { rows: AdminConveyorPipelineRow[] }) {
  const { density } = useTableDensity();
  const columns = useMemo(() => conveyorColumns(), []);

  return (
    <EntityList
      responsiveMode="auto"
      density={density}
      table={
        <AdminDataTable
          ariaLabel="Conveyor pipeline"
          columns={columns}
          data={rows}
          emptyMessage="Pipeline is empty."
          density={density}
          getRowId={(r) => r.submissionId}
        />
      }
      cards={
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.submissionId}
              className="rounded-md border border-border-hairline p-3 text-sm"
            >
              <a
                href={`/admin/submissions/${row.submissionId}`}
                className="font-medium text-primary"
              >
                {row.title}
              </a>
            </li>
          ))}
        </ul>
      }
    />
  );
}
