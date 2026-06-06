"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import { payoutColumns } from "@/components/admin/payouts-board/columns";
import { PayoutDrawerContent } from "@/components/admin/payouts-board/drawer";
import { PayoutsMobileCards } from "@/components/admin/payouts-board/mobile-cards";
import { useTableDensity } from "@/components/layout/density-provider";
import type { AdminPayoutRow } from "@/lib/data/http/admin.server";
import { formatDate } from "@/lib/ui/format";
import { EntityList, Sheet, SheetContent } from "@auction/ui";
import { useCallback, useMemo, useState } from "react";

type Props = {
  rows: AdminPayoutRow[];
};

export function AdminPayoutsBoard({ rows }: Props) {
  const { density } = useTableDensity();
  const [selected, setSelected] = useState<AdminPayoutRow | null>(null);
  const onOpen = useCallback((row: AdminPayoutRow) => setSelected(row), []);
  const columns = useMemo(() => payoutColumns(onOpen), [onOpen]);

  return (
    <>
      <EntityList
        responsiveMode="auto"
        density={density}
        table={
          <AdminDataTable
            ariaLabel="Payouts"
            columns={columns}
            data={rows}
            emptyMessage="No payouts match this filter."
            density={density}
            getRowId={(r) => r.id}
          />
        }
        cards={<PayoutsMobileCards rows={rows} onOpen={onOpen} />}
      />

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
          {selected ? (
            <div className="space-y-4 pt-2">
              <AdminPreviewSheetHeader
                title="Seller payout"
                fullPageHref="/admin/payouts"
                subtitle={
                  <p className="truncate font-body text-sm text-on-surface-variant">
                    {formatDate(selected.periodStart)} → {formatDate(selected.periodEnd)}
                  </p>
                }
              />
              <PayoutDrawerContent payout={selected} />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
