"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { type AdminLotTableRow, LotActionMenu } from "@/components/admin/lots-board/columns";
import Link from "next/link";

type Props = {
  rows: AdminLotTableRow[];
};

export function LotsMobileCards({ rows }: Props) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li
          key={r.id}
          className="rounded-lg border border-border-hairline bg-surface-container-low/30 p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link href={`/admin/lots/${r.id}`} className="font-headline text-sm text-primary">
                {r.title}
              </Link>
              <p className="mt-1 font-label text-[10px] uppercase text-on-surface-variant">
                {r.auctionType} · {r.endTimeLabel}
              </p>
              <p className="mt-1 font-headline text-sm tabular-nums">{r.currentPrice}</p>
              <div className="mt-2">
                <AdminStatusBadge domain="lot" status={r.status} />
              </div>
            </div>
            <LotActionMenu row={r} />
          </div>
        </li>
      ))}
    </ul>
  );
}
