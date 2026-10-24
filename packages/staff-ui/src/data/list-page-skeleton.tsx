"use client";

import { Skeleton } from "../display/states.js";
import { PageHeader } from "../shell/page-header.js";
import { DataTable } from "./data-table.js";
import type { DataColumn } from "./types.js";

/**
 * A list page while it loads: the real title, then a table card of the final height, so nothing
 * moves when the rows arrive.
 */
export function ListPageSkeleton({
  title,
  description,
  columns,
}: {
  title: string;
  description?: string;
  /** Column headers, so the header row is already right. */
  columns: readonly string[];
}) {
  const specs: DataColumn<never>[] = columns.map((header, index) => ({
    id: `${index}`,
    header,
    cell: () => null,
  }));
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <PageHeader title={title} {...(description ? { description } : {})} />
      <DataTable
        label={`${title}, loading`}
        columns={specs}
        data={[]}
        getRowId={() => ""}
        loading
        toolbar={
          <div className="flex flex-col">
            <div className="flex h-10 items-center gap-4 border-b border-staff-line-subtle px-4">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-14" />
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5">
              <Skeleton className="h-control-sm w-64 rounded-staff-sm" />
              <Skeleton className="h-control-sm w-20 rounded-staff-sm" />
            </div>
          </div>
        }
      />
    </div>
  );
}
