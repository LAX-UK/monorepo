"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { CatalogBoardTableHeader } from "@/components/admin/catalog/catalog-board-table-header";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { disputeColumns } from "@/components/admin/disputes-board/columns";
import { DisputeDrawerContent } from "@/components/admin/disputes-board/drawer";
import { DisputesMobileCards } from "@/components/admin/disputes-board/mobile-cards";
import { useTableDensity } from "@/components/layout/density-provider";
import type { AdminDisputeTableRow } from "@/lib/data/view-models/admin-disputes-table.vm";
import { EntityList, Sheet, SheetContent } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import { useCallback, useMemo, useState } from "react";

type Props = {
  rows: AdminDisputeTableRow[];
  pagination?: {
    offset: number;
    limit: number;
    countOnPage: number;
    prevHref: string | null;
    nextHref: string | null;
  } | null;
};

export function AdminDisputesBoard({ rows, pagination }: Props) {
  const { density } = useTableDensity();
  const [selected, setSelected] = useState<AdminDisputeTableRow | null>(null);
  const onOpen = useCallback((row: AdminDisputeTableRow) => setSelected(row), []);
  const columns = useMemo(() => disputeColumns(onOpen), [onOpen]);

  return (
    <>
      <div className="overflow-hidden rounded-shell-card border border-shell-stroke bg-surface-container-lowest shadow-[var(--shadow-rest)]">
        <CatalogBoardTableHeader
          leading={
            <>
              <h2 className="font-headline text-base font-semibold text-on-surface sm:text-lg">
                Disputes
              </h2>
              <Badge
                variant="secondary"
                className="h-6 min-w-6 rounded-full bg-on-surface px-2 font-label text-xs font-semibold text-surface-container-lowest"
              >
                {rows.length > 99 ? "99+" : rows.length}
              </Badge>
            </>
          }
        />
        <div className="p-4 sm:p-6">
          <EntityList
            responsiveMode="auto"
            density={density}
            table={
              <AdminDataTable
                ariaLabel="Payment disputes"
                columns={columns}
                data={rows}
                emptyMessage="No disputes match this filter."
                density={density}
                stickyFirstColumn
                showColumnPicker
              />
            }
            cards={<DisputesMobileCards rows={rows} onOpen={onOpen} />}
          />
        </div>
        {pagination ? (
          <div className="border-t border-shell-stroke px-4 py-3 sm:px-6">
            <CatalogPagination {...pagination} />
          </div>
        ) : null}
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
          {selected ? (
            <DisputeDrawerContent row={selected} onClose={() => setSelected(null)} />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
