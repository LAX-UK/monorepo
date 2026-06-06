"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import type { AdminPaymentTableRow } from "@/components/admin/admin-payments-data-table";
import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import { paymentColumns } from "@/components/admin/payments-board/columns";
import { PaymentDrawerContent } from "@/components/admin/payments-board/drawer";
import { PaymentsMobileCards } from "@/components/admin/payments-board/mobile-cards";
import { useTableDensity } from "@/components/layout/density-provider";
import { EntityList, Sheet, SheetContent } from "@auction/ui";
import { useCallback, useMemo, useState } from "react";

type Props = {
  rows: AdminPaymentTableRow[];
};

export function AdminPaymentsBoard({ rows }: Props) {
  const { density } = useTableDensity();
  const [selected, setSelected] = useState<AdminPaymentTableRow | null>(null);

  const onOpen = useCallback((row: AdminPaymentTableRow) => setSelected(row), []);
  const columns = useMemo(() => paymentColumns(onOpen), [onOpen]);

  return (
    <>
      <EntityList
        responsiveMode="auto"
        density={density}
        table={
          <AdminDataTable
            ariaLabel="Payments"
            columns={columns}
            data={rows}
            emptyMessage="No payments match this filter."
            density={density}
            stickyFirstColumn
            showColumnPicker
          />
        }
        cards={<PaymentsMobileCards rows={rows} onOpen={onOpen} />}
      />

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
          {selected ? (
            <div className="space-y-4 pt-2">
              <AdminPreviewSheetHeader
                title={selected.lotTitle}
                fullPageHref="/admin/payments"
                subtitle={
                  <p className="truncate font-body text-sm text-on-surface-variant">
                    {selected.buyerLabel?.trim() || "Buyer payment"}
                  </p>
                }
              />
              <PaymentDrawerContent p={selected} onClose={() => setSelected(null)} />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
