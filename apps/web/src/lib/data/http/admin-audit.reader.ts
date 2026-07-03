import "server-only";

import type { AdminDomainEventRow } from "@/lib/data/http/admin-audit.schema";
import { adminDomainEventRowSchema } from "@/lib/data/http/admin-audit.schema";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readJsonBody, readListEnvelope } from "@/lib/data/http/envelope";

export type { AdminDomainEventRow } from "@/lib/data/http/admin-audit.schema";

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
  const body = await readJsonBody(res);
  const { rows } = readListEnvelope(
    body,
    adminDomainEventRowSchema,
    "GET /admin/finance/dispute-domain-events",
  );
  return rows;
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
  const body = await readJsonBody(res);
  const { rows } = readListEnvelope(
    body,
    adminDomainEventRowSchema,
    "GET /admin/audit/domain-events",
  );
  return rows;
}
