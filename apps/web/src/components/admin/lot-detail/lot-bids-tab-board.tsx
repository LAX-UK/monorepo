"use client";

import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import {
  DetailBoardKpiStrip,
  DetailBoardShell,
  DetailEntityTable,
} from "@/components/admin/catalog/detail-board";
import { lotDetailTabHref } from "@/components/admin/lot-detail/lot-detail-types";
import { type LotBidTableRow, buildLotBidsKpiTiles } from "@/lib/data/view-models/lot-bids-tab.vm";
import { formatMoney } from "@/lib/ui/format";
import Link from "next/link";

type Props = {
  lotId: string;
  rows: LotBidTableRow[];
  capped?: boolean;
};

export function LotBidsTabBoard({ lotId, rows, capped = false }: Props) {
  const kpiTiles = buildLotBidsKpiTiles(rows);

  return (
    <div className="space-y-6">
      <DetailBoardKpiStrip ariaLabel="Bid summary" tiles={kpiTiles} />
      <DetailBoardShell
        title="Bid history"
        description="All bids placed on this lot, newest first."
        count={rows.length}
      >
        {capped ? (
          <p className="mb-4 font-body text-sm text-on-surface-variant">
            Showing the latest 100 bids.{" "}
            <Link href={lotDetailTabHref(lotId, "overview")} className="text-link hover:underline">
              View lot overview →
            </Link>
          </p>
        ) : null}
        <DetailEntityTable
          rows={rows}
          getRowId={(row) => row.id}
          emptyTitle="No bids yet"
          emptyDescription="Bids appear when the lot is live and bidders place offers."
          columns={[
            {
              id: "amount",
              header: "Amount",
              cell: (row) => (
                <span className="font-medium tabular-nums">
                  {formatMoney(row.amount)}
                  {row.isWinning ? (
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
              cell: (row) => (
                <span className="text-on-surface-variant">
                  {row.isAutoBid ? "Auto" : "Manual"}
                  {row.maxAutoBidAmount ? (
                    <span className="mt-0.5 block text-[11px] text-on-surface-variant/80">
                      Max {formatMoney(row.maxAutoBidAmount)}
                    </span>
                  ) : null}
                </span>
              ),
            },
            {
              id: "bidder",
              header: "Bidder",
              cell: (row) => <span>{row.bidderLabel}</span>,
            },
            {
              id: "placed",
              header: "Placed",
              cell: (row) => <AdminTableDateTimeCell iso={row.placedAtIso} mode="timestamp" />,
            },
          ]}
        />
      </DetailBoardShell>
    </div>
  );
}
