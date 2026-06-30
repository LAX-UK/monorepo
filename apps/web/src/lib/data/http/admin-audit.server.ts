import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";

export type AdminDomainEventRow = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  actorUserId: string | null;
  actingLegalEntityId: string | null;
  occurredAt: Date;
};

function parseAdminDomainEventRows(body: {
  data: Record<string, unknown>[];
}): AdminDomainEventRow[] {
  return body.data.map((row) => ({
    id: String(row.id ?? ""),
    aggregateType: String(row.aggregateType ?? ""),
    aggregateId: String(row.aggregateId ?? ""),
    eventType: String(row.eventType ?? ""),
    payload: (row.payload as Record<string, unknown>) ?? {},
    actorUserId: row.actorUserId == null ? null : String(row.actorUserId),
    actingLegalEntityId: row.actingLegalEntityId == null ? null : String(row.actingLegalEntityId),
    occurredAt: new Date(String(row.occurredAt ?? "")),
  }));
}

/** Finance admin: folded Stripe dispute cases for the disputes queue. */
export async function getAdminDisputeCases(params: {
  limit?: number;
  offset?: number;
  status?: "open" | "under_review" | "closed";
}): Promise<{
  rows: import("@auction/types").AdminDisputeCaseRow[];
  hasNextPage: boolean;
  summary: import("@auction/types").AdminDisputeCaseSummary;
}> {
  const qs = new URLSearchParams();
  qs.set("limit", String(params.limit ?? 50));
  qs.set("offset", String(params.offset ?? 0));
  if (params.status) qs.set("status", params.status);
  const res = await authedServerFetch(`/admin/finance/disputes?${qs.toString()}`);
  if (!res.ok) throw new Error(`Failed to load dispute cases: ${res.status}`);
  const body = (await res.json()) as {
    data: Record<string, unknown>[];
    hasNextPage?: boolean;
    summary?: Record<string, unknown>;
  };
  const rows = body.data.map((row) => ({
    stripeDisputeId: String(row.stripeDisputeId ?? ""),
    paymentId: String(row.paymentId ?? ""),
    status: row.status as import("@auction/types").DisputeCaseStatus,
    amountCents: Number(row.amountCents ?? 0),
    currency: String(row.currency ?? "gbp"),
    reason: row.reason == null ? null : String(row.reason),
    sellerLegalEntityId: String(row.sellerLegalEntityId ?? ""),
    openedAt: String(row.openedAt ?? ""),
    closedAt: row.closedAt == null ? null : String(row.closedAt),
    outcome: row.outcome as import("@auction/types").DisputeCaseOutcome,
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
  }));
  const summaryRaw = body.summary ?? {};
  const summary: import("@auction/types").AdminDisputeCaseSummary = {
    open: Number(summaryRaw.open ?? 0),
    underReview: Number(summaryRaw.underReview ?? 0),
    won: Number(summaryRaw.won ?? 0),
    lost: Number(summaryRaw.lost ?? 0),
    closed: Number(summaryRaw.closed ?? 0),
  };
  return { rows, hasNextPage: Boolean(body.hasNextPage), summary };
}

/** Finance admin: count of open dispute cases for nav badges. */
export async function getAdminDisputeOpenCount(): Promise<number> {
  const res = await authedServerFetch("/admin/finance/disputes/open-count");
  if (!res.ok) throw new Error(`Failed to load dispute open count: ${res.status}`);
  const body = (await res.json()) as { data?: { count?: number } };
  return Number(body.data?.count ?? 0);
}

/** Finance admin + platform admin: Stripe dispute-related domain events only. */
export async function getAdminFinanceDisputeDomainEvents(params: {
  limit?: number;
  offset?: number;
}): Promise<AdminDomainEventRow[]> {
  const qs = new URLSearchParams();
  qs.set("limit", String(params.limit ?? 200));
  qs.set("offset", String(params.offset ?? 0));
  const res = await authedServerFetch(`/admin/finance/dispute-domain-events?${qs.toString()}`);
  if (!res.ok) throw new Error(`Failed to load dispute domain events: ${res.status}`);
  const body = (await res.json()) as { data: Record<string, unknown>[] };
  return parseAdminDomainEventRows(body);
}

/** Domain events for a single aggregate (lot, sale, etc.). */
export async function getAdminDomainEventsForAggregate(params: {
  aggregateType: string;
  aggregateId: string;
  limit?: number;
  offset?: number;
}): Promise<AdminDomainEventRow[]> {
  const qs = new URLSearchParams();
  qs.set("aggregateType", params.aggregateType);
  qs.set("aggregateId", params.aggregateId);
  qs.set("limit", String(params.limit ?? 100));
  qs.set("offset", String(params.offset ?? 0));
  const res = await authedServerFetch(`/admin/audit/domain-events?${qs.toString()}`);
  if (!res.ok) throw new Error(`Failed to load domain events: ${res.status}`);
  const body = (await res.json()) as { data: Record<string, unknown>[] };
  return parseAdminDomainEventRows(body);
}
