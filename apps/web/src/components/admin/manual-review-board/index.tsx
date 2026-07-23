"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import { manualReviewColumns } from "@/components/admin/manual-review-board/columns";
import { ManualReviewDrawerContent } from "@/components/admin/manual-review-board/drawer";
import { ManualReviewMobileCards } from "@/components/admin/manual-review-board/mobile-cards";
import { useTableDensity } from "@/components/layout/density-provider";
import type { AdminManualReviewPaymentRow } from "@/lib/data/http/admin.server";
import { EntityList, Sheet, SheetContent } from "@auction/ui";
import { useCallback, useMemo, useState } from "react";

export function AdminManualReviewBoard({
  rows,
  canOpenComplianceQueues = false,
}: {
  rows: AdminManualReviewPaymentRow[];
  canOpenComplianceQueues?: boolean;
}) {
  const { density } = useTableDensity();
  const [selected, setSelected] = useState<AdminManualReviewPaymentRow | null>(null);
  const onOpen = useCallback((row: AdminManualReviewPaymentRow) => setSelected(row), []);
  const columns = useMemo(() => manualReviewColumns(onOpen), [onOpen]);

  return (
    <>
      <EntityList
        responsiveMode="auto"
        density={density}
        table={
          <AdminDataTable
            ariaLabel="Manual review payments"
            columns={columns}
            data={rows}
            emptyMessage="No manual review payments."
            density={density}
            getRowId={(r) => r.paymentId}
          />
        }
        cards={<ManualReviewMobileCards rows={rows} onOpen={onOpen} />}
      />
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
          {selected ? (
            <div className="space-y-4 pt-2">
              <AdminPreviewSheetHeader
                title={selected.lotTitle}
                fullPageHref={"/admin/payments?manualReview=1"}
                subtitle={
                  <p className="font-body text-sm text-on-surface-variant">
                    {selected.winnerEmail}
                  </p>
                }
              />
              <ManualReviewDrawerContent
                payment={selected}
                canOpenComplianceQueues={canOpenComplianceQueues}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
