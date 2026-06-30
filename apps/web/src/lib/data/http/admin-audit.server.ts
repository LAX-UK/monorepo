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
