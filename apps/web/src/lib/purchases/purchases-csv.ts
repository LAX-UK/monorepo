import { csvDocument } from "@/lib/workspace/csv";
import { type PurchasesListQuery, purchasesListSearch } from "./purchases-list";
import type { PurchaseCardVm } from "./purchases.vm";

const HEADER = [
  "lot_number",
  "title",
  "sale",
  "won_by",
  "won_on",
  "status",
  "total",
  "due_on",
  "lot_id",
] as const;

const DAY = (at: number) => new Date(at).toISOString().slice(0, 10);

/** Purchases as CSV for reconciling: one row each, dates as `YYYY-MM-DD`, amounts as shown. */
export function purchasesCsv(cards: readonly PurchaseCardVm[]): string {
  return csvDocument(
    HEADER,
    cards.map((card) => [
      card.lotLabel?.replace(/^Lot /, "") ?? "",
      card.title,
      card.saleTitle ?? "",
      card.wonBy ?? "",
      DAY(card.wonAt),
      card.badge.label,
      card.amount === "—" ? "" : card.amount,
      card.tab === "to-pay" ? DAY(card.dueAt) : "",
      card.lotId,
    ]),
  );
}

export function purchasesCsvFilename(scope: string, now: Date): string {
  return `lax-purchases-${scope}-${now.toISOString().slice(0, 10)}.csv`;
}

/** The export's address: the list's own query, then what to export and the period. */
export function purchasesExportHref(
  query: PurchasesListQuery,
  request: { scope: "view" | "all"; from?: string; to?: string },
): string {
  const params = new URLSearchParams(purchasesListSearch(query).replace(/^\?/, ""));
  params.set("scope", request.scope);
  if (request.from) params.set("from", request.from);
  if (request.to) params.set("to", request.to);
  return `/purchases/export?${params.toString()}`;
}
