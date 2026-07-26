import type { AdminUserBidRow } from "@/lib/data/http/admin.server";
import { presentClientBidStatus } from "@/lib/data/view-models/client-commerce-tab.vm";
import { formatCsvDocument } from "@auction/exports";

const COLUMNS = [
  { key: "lot", header: "Lot" },
  { key: "sale", header: "Sale" },
  { key: "amount", header: "Amount" },
  { key: "status", header: "Status" },
  { key: "channel", header: "Channel" },
  { key: "placedAt", header: "Placed at" },
] as const;

function toExportRow(bid: AdminUserBidRow): Record<string, string> {
  const status = presentClientBidStatus(bid);
  return {
    lot: bid.lotTitle,
    sale: bid.saleTitle ?? "",
    amount: bid.amount,
    status: status.label,
    channel: bid.placedVia ?? "web",
    placedAt: bid.createdAt.toISOString(),
  };
}

/** Client-side CSV export for the client bids table. */
export function downloadClientBidsCsv(rows: readonly AdminUserBidRow[], clientLabel: string): void {
  const slug = clientLabel
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const filename = `${slug || "client"}-bids.csv`;
  const csv = formatCsvDocument([...COLUMNS], rows.map(toExportRow));

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
