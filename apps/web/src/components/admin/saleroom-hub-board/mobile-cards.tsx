"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { saleDetailTabHref } from "@/components/admin/sale-detail/sale-detail-types";
import { SaleroomHubSessionBadge } from "@/components/admin/saleroom-hub-board/saleroom-hub-session-badge";
import type { AdminSaleListRow } from "@/lib/data/http/admin.server";
import { getSaleDeliveryModeLabel } from "@/lib/sale-type-presentation";
import { Button } from "@auction/ui";
import Link from "next/link";

type Props = {
  rows: AdminSaleListRow[];
};

export function SaleroomHubMobileCards({ rows }: Props) {
  return (
    <ul className="divide-y divide-border-hairline rounded-lg border border-border-hairline">
      {rows.map((row) => (
        <li key={row.sale.id} className="p-4">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/admin/saleroom/${row.sale.id}`}
              className="min-w-0 flex-1 font-medium text-link hover:underline"
            >
              {row.sale.title}
            </Link>
            <AdminStatusBadge domain="sale" status={row.sale.status} size="sm" />
          </div>
          <p className="mt-1 font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
            {getSaleDeliveryModeLabel(row.sale.deliveryMode)} sale
          </p>
          <div className="mt-2">
            <SaleroomHubSessionBadge saleId={row.sale.id} />
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <Button variant="secondary" size="sm" className="min-h-11 w-full" asChild>
              <Link href={`/admin/saleroom/${row.sale.id}`}>Open clerk console</Link>
            </Button>
            <Button variant="outline" size="sm" className="min-h-11 w-full" asChild>
              <Link href={`${saleDetailTabHref(row.sale.id, "registrations")}#check-in`}>
                Check-in
              </Link>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
