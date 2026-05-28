"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import { lotDetailTabHref } from "@/components/admin/lot-detail/lot-detail-types";
import { formatDateTime, formatMoney } from "@/lib/ui/format";
import type { Bid } from "@auction/types";
import { EntityList } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";

const BID_FETCH_LIMIT = 100;

function columns(): ColumnDef<Bid>[] {
  return [
    {
      accessorKey: "amount",
      header: "Amount",
      meta: { numeric: true },
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">
          {formatMoney(row.original.amount)}
          {row.original.isWinning ? (
            <span className="ml-2 rounded bg-success/10 px-1.5 py-0.5 font-label text-[10px] uppercase text-success">
              Winning
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: ({ row }) => (
        <span className="text-on-surface-variant">
          {row.original.isAutoBid ? "Auto" : "Manual"}
          {row.original.maxAutoBidAmount ? (
            <span className="mt-0.5 block text-[11px] text-on-surface-variant/80">
              Max {formatMoney(row.original.maxAutoBidAmount)}
              {row.original.autoBidStepAmount
                ? ` · +${formatMoney(row.original.autoBidStepAmount)}`
                : null}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "bidder",
      header: "Bidder",
      cell: ({ row }) => {
        const bidderId = row.original.bidderId;
        if (!bidderId) return <span className="text-on-surface-variant">—</span>;
        return (
          <Link
            href={`/admin/clients/${bidderId}`}
            className="font-mono text-xs text-primary hover:underline"
          >
            {bidderId.slice(0, 8)}…
          </Link>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Placed",
      cell: ({ row }) => (
        <span className="text-xs text-on-surface-variant">
          {formatDateTime(row.original.createdAt)}
        </span>
      ),
    },
  ];
}

function highestBidAmount(bids: Bid[]): string | null {
  if (bids.length === 0) return null;
  let max = Number.NEGATIVE_INFINITY;
  for (const bid of bids) {
    const n = Number.parseFloat(String(bid.amount));
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return Number.isFinite(max) ? String(max) : null;
}

type Props = {
  lotId: string;
  bids: Bid[];
  capped?: boolean;
};

export function AdminLotBidsTable({ lotId, bids, capped = false }: Props) {
  const sortedBids = useMemo(
    () =>
      [...bids].sort((a, b) => {
        const am = Number.parseFloat(String(a.amount));
        const bm = Number.parseFloat(String(b.amount));
        if (Number.isNaN(am) || Number.isNaN(bm)) return 0;
        return bm - am;
      }),
    [bids],
  );
  const tableColumns = useMemo(() => columns(), []);
  const high = highestBidAmount(sortedBids);

  const cards = (
    <ul className="space-y-3 lg:hidden">
      {sortedBids.map((bid) => (
        <li
          key={bid.id}
          className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-4"
        >
          <p className="font-medium tabular-nums text-on-surface">
            {formatMoney(bid.amount)}
            {bid.isWinning ? (
              <span className="ml-2 rounded bg-success/10 px-1.5 py-0.5 font-label text-[10px] uppercase text-success">
                Winning
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {bid.isAutoBid ? "Auto" : "Manual"}
            {bid.maxAutoBidAmount ? ` · Max ${formatMoney(bid.maxAutoBidAmount)}` : ""}
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">{formatDateTime(bid.createdAt)}</p>
          {bid.bidderId ? (
            <Link
              href={`/admin/clients/${bid.bidderId}`}
              className="mt-2 inline-block font-mono text-xs text-primary hover:underline"
            >
              {bid.bidderId.slice(0, 8)}…
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );

  if (sortedBids.length === 0) {
    return (
      <CatalogDetailTabPanel title="Bids" description="Bid history for this lot.">
        <AdminEmptyState
          title="No bids yet"
          description="Bids placed on this lot will appear here once the lot is live."
        />
      </CatalogDetailTabPanel>
    );
  }

  return (
    <CatalogDetailTabPanel
      title="Bids"
      description="Most recent bids first. Click a bidder ID to open their admin profile."
      framed={false}
    >
      <div className="space-y-4 rounded-xl border border-border-hairline bg-surface-container-low/40 p-6">
        <p className="font-body text-sm text-on-surface-variant">
          {capped
            ? `Showing latest ${BID_FETCH_LIMIT} bids`
            : `${sortedBids.length} bid${sortedBids.length === 1 ? "" : "s"}`}
          {high ? (
            <>
              {" "}
              · high{" "}
              <span className="font-medium tabular-nums text-on-surface">{formatMoney(high)}</span>
            </>
          ) : null}
        </p>
        <EntityList
          responsiveMode="auto"
          table={
            <AdminDataTable
              ariaLabel="Lot bids"
              columns={tableColumns}
              data={sortedBids}
              getRowId={(b) => b.id}
            />
          }
          cards={cards}
        />
        <p className="font-body text-xs text-on-surface-variant">
          <Link href={lotDetailTabHref(lotId, "activity")} className="text-primary hover:underline">
            View bid-related activity in the Activity tab →
          </Link>
        </p>
      </div>
    </CatalogDetailTabPanel>
  );
}
