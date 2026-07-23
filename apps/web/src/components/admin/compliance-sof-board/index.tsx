"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { CatalogBoardTableHeader } from "@/components/admin/catalog/catalog-board-table-header";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { sofColumns, sofTableAriaLabel } from "@/components/admin/compliance-sof-board/columns";
import type { SofBoardPagination } from "@/components/admin/compliance-sof-board/container";
import { SofMobileCards } from "@/components/admin/compliance-sof-board/mobile-cards";
import { useTableDensity } from "@/components/layout/density-provider";
import type { SofListStatus } from "@/lib/admin/sof-list-query";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import { EntityList, cn } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import { useMemo } from "react";

type Props = {
  rows: AdminSofTableRow[];
  status: SofListStatus;
  canReopen: boolean;
  listReturnTarget?: string | undefined;
  pagination?: SofBoardPagination | null | undefined;
};

export function ComplianceSofBoard({
  rows,
  status,
  canReopen,
  listReturnTarget,
  pagination,
}: Props) {
  const { density } = useTableDensity();
  const columns = useMemo(
    () => sofColumns({ status, canReopen, listReturnTarget }),
    [status, canReopen, listReturnTarget],
  );
  const emptyMessage =
    status === "pending"
      ? "No pending Source of Funds cases."
      : status === "rejected"
        ? "No rejected Source of Funds cases."
        : "No approved Source of Funds cases.";

  const title =
    status === "pending"
      ? "Pending cases"
      : status === "rejected"
        ? "Rejected cases"
        : "Approved cases";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-shell-card border border-shell-stroke bg-surface-container-lowest shadow-[var(--shadow-rest)]",
      )}
    >
      <CatalogBoardTableHeader
        leading={
          <>
            <h2 className="font-headline text-base font-semibold text-on-surface sm:text-lg">
              {title}
            </h2>
            <Badge
              variant="secondary"
              className="h-6 min-w-6 rounded-full bg-on-surface px-2 font-label text-xs font-semibold text-surface-container-lowest"
            >
              {pagination?.total ?? rows.length}
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
              ariaLabel={sofTableAriaLabel(status)}
              columns={columns}
              data={rows}
              emptyMessage={emptyMessage}
              density={density}
              getRowId={(r) => r.id}
              stickyFirstColumn
            />
          }
          cards={
            <SofMobileCards
              rows={rows}
              status={status}
              canReopen={canReopen}
              listReturnTarget={listReturnTarget}
            />
          }
        />
      </div>
      {pagination ? (
        <div className="border-t border-shell-stroke px-4 py-3 sm:px-6">
          <CatalogPagination {...pagination} />
        </div>
      ) : null}
    </div>
  );
}
