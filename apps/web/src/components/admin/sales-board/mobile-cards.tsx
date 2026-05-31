"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { CatalogMobileCardShell } from "@/components/admin/catalog/catalog-mobile-card-shell";
import { CatalogVirtualizedList } from "@/components/admin/catalog/catalog-virtualized-list";
import { adminSaleEditHref, adminSaleHref } from "@/lib/admin/catalog-route-helpers";
import { Sparkline } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { SaleBoardMobileActionMenu } from "./mobile-action-menu";
import type { AdminSaleBoardRow } from "./types";

type Props = {
  rows: AdminSaleBoardRow[];
  canManageSales: boolean;
  rowSelection: Record<string, boolean>;
  onRowSelectionChange: (saleId: string, checked: boolean) => void;
};

export function SalesBoardMobileCards({
  rows,
  canManageSales,
  rowSelection,
  onRowSelectionChange,
}: Props) {
  return (
    <CatalogVirtualizedList itemCount={rows.length}>
      {rows.map((r) => {
        const canEdit = canManageSales && (r.status === "draft" || r.status === "scheduled");
        return (
          <CatalogMobileCardShell
            key={r.saleId}
            id={r.saleId}
            title={r.title}
            selected={rowSelection[r.saleId]}
            onSelectedChange={(checked) => onRowSelectionChange(r.saleId, checked)}
            selectionLabel={`Select ${r.title}`}
            trailing={<SaleBoardMobileActionMenu row={r} canManageSales={canManageSales} />}
            status={<AdminStatusBadge domain="sale" status={r.status} />}
            footer={
              <>
                <div className="flex items-center justify-between gap-2">
                  <Sparkline values={r.sparklineValues} width={96} height={28} tone="lot-orange" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {canEdit ? (
                    <Button variant="outline" size="sm" className="min-h-11 flex-1" asChild>
                      <Link href={adminSaleEditHref(r.saleId)}>Edit</Link>
                    </Button>
                  ) : null}
                  <Button variant="secondary" size="sm" className="min-h-11 flex-1" asChild>
                    <Link href={adminSaleHref(r.saleId)}>Open</Link>
                  </Button>
                </div>
              </>
            }
          >
            <Link href={adminSaleHref(r.saleId)} className="font-headline text-sm text-primary">
              {r.title}
            </Link>
            <p className="font-label text-[10px] uppercase text-on-surface-variant">
              {r.lotCount} lot{r.lotCount === 1 ? "" : "s"}
            </p>
          </CatalogMobileCardShell>
        );
      })}
    </CatalogVirtualizedList>
  );
}
