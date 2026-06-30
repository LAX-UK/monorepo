import {
  type AdminDisputeTableRow,
  buildAdminDisputeTableRows,
} from "@/lib/data/view-models/admin-disputes-table.vm";
import type { AdminDisputeCaseRow, AdminDisputeCaseSummary } from "@auction/types";

export type DisputeListStatus = "open" | "under_review" | "closed";

export type AdminDisputesPageParams = {
  limit: number;
  offset: number;
  status?: DisputeListStatus;
};

export type AdminDisputesPage = {
  rows: AdminDisputeTableRow[];
  hasNextPage: boolean;
  summary: AdminDisputeCaseSummary;
};

type AdminDisputesWireRow = Record<string, unknown>;

export function buildAdminDisputesSearchParams(params: AdminDisputesPageParams): string {
  const search = new URLSearchParams();
  search.set("limit", String(params.limit));
  search.set("offset", String(params.offset));
  if (params.status) search.set("status", params.status);
  return search.toString();
}

function parseAdminDisputeWireRow(row: AdminDisputesWireRow): AdminDisputeCaseRow {
  return {
    stripeDisputeId: String(row.stripeDisputeId ?? ""),
    paymentId: String(row.paymentId ?? ""),
    status: row.status as AdminDisputeCaseRow["status"],
    amountCents: Number(row.amountCents ?? 0),
    currency: String(row.currency ?? "gbp"),
    reason: row.reason == null ? null : String(row.reason),
    sellerLegalEntityId: String(row.sellerLegalEntityId ?? ""),
    openedAt: String(row.openedAt ?? ""),
    closedAt: row.closedAt == null ? null : String(row.closedAt),
    outcome: row.outcome as AdminDisputeCaseRow["outcome"],
    ...(row.lotId != null ? { lotId: String(row.lotId) } : {}),
    ...(row.lotTitle != null ? { lotTitle: String(row.lotTitle) } : {}),
    ...(row.buyerId != null ? { buyerId: String(row.buyerId) } : {}),
    ...(row.buyerLabel != null ? { buyerLabel: String(row.buyerLabel) } : {}),
    ...(row.sellerDisplayName != null ? { sellerDisplayName: String(row.sellerDisplayName) } : {}),
    ...(Array.isArray(row.timelineEvents)
      ? {
          timelineEvents: row.timelineEvents.map((e) => {
            const ev = e as Record<string, unknown>;
            return {
              id: String(ev.id ?? ""),
              eventType: String(ev.eventType ?? ""),
              payload: (ev.payload as Record<string, unknown>) ?? {},
              occurredAt: String(ev.occurredAt ?? ""),
            };
          }),
        }
      : {}),
  };
}

export function parseAdminDisputesPageBody(body: {
  data: AdminDisputesWireRow[];
  hasNextPage?: boolean;
  summary?: Record<string, unknown>;
}): AdminDisputesPage {
  const wireRows = body.data.map(parseAdminDisputeWireRow);
  const summaryRaw = body.summary ?? {};
  const summary: AdminDisputeCaseSummary = {
    open: Number(summaryRaw.open ?? 0),
    underReview: Number(summaryRaw.underReview ?? 0),
    won: Number(summaryRaw.won ?? 0),
    lost: Number(summaryRaw.lost ?? 0),
    closed: Number(summaryRaw.closed ?? 0),
  };
  return {
    rows: buildAdminDisputeTableRows(wireRows),
    hasNextPage: Boolean(body.hasNextPage),
    summary,
  };
}
