"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { adminSaleHref } from "@/lib/admin/catalog-route-helpers";
import { Sparkline } from "@auction/ui";
import { Checkbox } from "@auction/ui/components/checkbox";
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
    <ul className="space-y-3">
      {rows.map((r) => (
        <li
          key={r.saleId}
          className="rounded-sm border border-border-hairline bg-surface-container-lowest/80 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <Checkbox
                className="mt-1 min-h-11 min-w-11 md:hidden"
                checked={Boolean(rowSelection[r.saleId])}
                onCheckedChange={(checked) => onRowSelectionChange(r.saleId, checked === true)}
                aria-label={`Select ${r.title}`}
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={adminSaleHref(r.saleId)}
                  className="font-headline text-base text-on-surface hover:text-primary"
                >
                  {r.title}
                </Link>
                <p className="mt-1 font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                  {r.lotCount} lot{r.lotCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <AdminStatusBadge domain="sale" status={r.status} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <Sparkline values={r.sparklineValues} width={96} height={28} tone="lot-orange" />
            <SaleBoardMobileActionMenu row={r} canManageSales={canManageSales} />
          </div>
        </li>
      ))}
    </ul>
  );
}
