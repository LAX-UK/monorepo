import type { ClassifiedBid, MyBidTab } from "./my-bid-status";
import { MY_BID_STATUS_LABEL } from "./my-bids.vm";

const HEADER = [
  "lot_number",
  "title",
  "sale",
  "status",
  "current_price",
  "your_maximum",
  "closes_at",
  "placed_via",
  "lot_id",
] as const;

/** Spreadsheet apps run cells that start with these as formulas; a leading quote stops that. */
const FORMULA_PREFIX = /^[=+\-@]/;

export function csvCell(value: string): string {
  const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** One view of My bids as CSV, in the order the page shows it. Amounts are plain numbers. */
export function myBidsCsv(
  entries: readonly ClassifiedBid[],
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
      lot?.currentPrice ?? "",
      bid.maxAutoBidAmount ?? bid.amount,
      lot ? lot.endTime.toISOString() : "",
      bid.placedVia ?? "",
      bid.lotId,
    ];
    lines.push(cells.map(csvCell).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function myBidsCsvFilename(tab: MyBidTab, now: Date): string {
  return `lax-bids-${tab}-${now.toISOString().slice(0, 10)}.csv`;
}
