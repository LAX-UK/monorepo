"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { CatalogMobileCardShell } from "@/components/admin/catalog/catalog-mobile-card-shell";
import { CatalogVirtualizedList } from "@/components/admin/catalog/catalog-virtualized-list";
import type { AdminLotFulfilmentListRow } from "@/lib/data/http/admin.server";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  rows: AdminLotFulfilmentListRow[];
  onOpen: (row: AdminLotFulfilmentListRow) => void;
};

export function LotFulfilmentMobileCards({ rows, onOpen }: Props) {
  return (
    <CatalogVirtualizedList itemCount={rows.length}>
      {rows.map((row) => (
        <CatalogMobileCardShell
          key={row.id}
          id={row.id}
          title={row.lotTitle ?? row.lotId}
          selectionLabel={`Open ${row.lotTitle ?? "fulfilment row"}`}
          status={<AdminStatusBadge domain="fulfilment" status={row.status} />}
          footer={
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-11 flex-1"
                onClick={() => onOpen(row)}
              >
                Queue actions
              </Button>
              <Button variant="outline" size="sm" className="min-h-11 flex-1" asChild>
                <Link href={`/admin/lots/${row.lotId}`}>Open lot</Link>
              </Button>
            </div>
          }
        >
          <p className="font-headline text-sm text-on-surface">{row.lotTitle ?? row.lotId}</p>
          <p className="mt-1 font-body text-xs text-on-surface-variant">
            {row.fulfilmentMethod ? row.fulfilmentMethod.replaceAll("_", " ") : "Fulfilment"}
          </p>
        </CatalogMobileCardShell>
      ))}
    </CatalogVirtualizedList>
  );
}
