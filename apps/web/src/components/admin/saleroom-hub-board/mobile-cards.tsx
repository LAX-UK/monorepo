"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { AdminSaleListRow } from "@/lib/data/http/admin.server";
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
            Onsite sale
          </p>
          <Button variant="secondary" size="sm" className="mt-3 min-h-11 w-full" asChild>
            <Link href={`/admin/saleroom/${row.sale.id}`}>Open clerk console</Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}
