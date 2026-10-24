"use client";

import { MetricStrip } from "../display/metric-strip.js";
import { Skeleton } from "../display/states.js";
import { PageHeader } from "../shell/page-header.js";
import { DataTable } from "./data-table.js";
import type { DataColumn } from "./types.js";

/**
 * A list page while it loads, in the ListPage layout: the real title, the metric strip when the
 * page has one, then a table card of the final height, so nothing moves when the rows arrive.
 * For route `loading` files, which cannot pass the page's column functions.
 */
export function ListPageSkeleton({
  title,
  description,
  columns,
  metrics = 0,
  views = true,
}: {
  title: string;
  description?: string;
  /** Column headers, so the header row is already right. */
  columns: readonly string[];
  /** How many metrics the page's summary shows; 0 for none. */
  metrics?: number;
  /** Whether the list has view tabs. */
  views?: boolean;
}) {
  const specs: DataColumn<never>[] = columns.map((header, index) => ({
    id: `${index}`,
    header,
    cell: () => null,
  }));
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <PageHeader title={title} {...(description ? { description } : {})} />
      {metrics > 0 ? (
        <MetricStrip
          label={`${title} summary, loading`}
          period={<Skeleton className="h-3 w-24" />}
          items={[]}
          loading
          placeholders={metrics}
        />
      ) : null}
      <DataTable
        label={`${title}, loading`}
        columns={specs}
        data={[]}
        getRowId={() => ""}
        loading
        toolbar={
          <div className="flex flex-col">
            {views ? (
              <div className="flex h-10 items-center gap-4 border-b border-staff-line-subtle px-4">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-14" />
              </div>
            ) : null}
            <div className="flex items-center gap-2 px-3 py-2.5">
              <Skeleton className="h-control-sm min-w-0 flex-1 rounded-staff-sm" />
              <Skeleton className="h-control-sm w-20 rounded-staff-sm" />
              <Skeleton className="hidden h-control-sm w-24 rounded-staff-sm md:block" />
            </div>
          </div>
        }
      />
    </div>
  );
}
