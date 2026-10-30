import type { BidWithLot } from "@/lib/data/dto/dashboard-dtos";
import { csvCell } from "@/lib/workspace/csv";
import { type BidsListQuery, bidsListSearch } from "./bids-list";
import type { MyBidStatus } from "./my-bid-status";
import { MY_BID_STATUS_LABEL } from "./my-bids.vm";

const HEADER = [
  "lot_number",
  "title",
  "sale",
  "status",
  "placed_by",
  "current_or_final_price",
  "hammer_price",
  "your_maximum",
  "closes_at",
  "placed_via",
  "lot_id",
] as const;

export { csvCell };

export type CsvBid = { row: BidWithLot; status: MyBidStatus };

/** Bids as CSV, in the order given. Amounts are plain numbers; times are ISO 8601 in UTC. */
export function myBidsCsv(
  entries: readonly CsvBid[],
  saleTitleById: Readonly<Record<string, string>>,
): string {
  const lines = [HEADER.join(",")];
  for (const { row, status } of entries) {
    const { bid, lot } = row;
    const cells = [
      lot?.lotNumber != null ? String(lot.lotNumber) : "",
      lot?.title ?? "",
      lot?.saleId ? (saleTitleById[lot.saleId] ?? "") : "",
      MY_BID_STATUS_LABEL[status],
      row.placedBy?.name ?? "",
      lot?.currentPrice ?? "",
      status === "won" ? (lot?.checkoutPricing?.hammerMajor ?? lot?.currentPrice ?? "") : "",
      bid.maxAutoBidAmount ?? bid.amount,
      lot ? lot.endTime.toISOString() : "",
      bid.placedVia ?? "",
      bid.lotId,
    ];
    lines.push(cells.map((cell) => csvCell(String(cell))).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function myBidsCsvFilename(scope: string, now: Date): string {
  return `lax-bids-${scope}-${now.toISOString().slice(0, 10)}.csv`;
}

/** The export's address: the list's own query, then what to export and the period. */
export function bidsExportHref(
  query: BidsListQuery,
  request: { scope: "view" | "all"; from?: string; to?: string },
): string {
  const params = new URLSearchParams(bidsListSearch(query).replace(/^\?/, ""));
  params.set("tab", query.view);
  params.set("scope", request.scope);
  if (request.from) params.set("from", request.from);
  if (request.to) params.set("to", request.to);
  return `/bids/export?${params.toString()}`;
}
