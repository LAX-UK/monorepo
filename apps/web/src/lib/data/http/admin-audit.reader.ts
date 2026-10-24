import "server-only";

import type {
  AdminAuditActorOption,
  AdminAuditLogRow,
  AdminDomainEventRow,
} from "@/lib/data/http/admin-audit.schema";
import {
  adminAuditActorOptionSchema,
  adminAuditLogRowSchema,
  adminDomainEventRowSchema,
} from "@/lib/data/http/admin-audit.schema";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readJsonBody, readListEnvelope } from "@/lib/data/http/envelope";
import type { AuditLogView } from "@auction/types";

export type {
  AdminAuditActor,
  AdminAuditActorOption,
  AdminAuditLogRow,
  AdminDomainEventRow,
} from "@/lib/data/http/admin-audit.schema";

/** Filters of the staff audit log, as the API's `/admin/audit/log` takes them. */
export type AdminAuditLogParams = {
  limit?: number;
  offset?: number;
  q?: string;
  actorUserId?: string;
  view?: AuditLogView;
  eventTypes?: readonly string[];
  aggregateType?: string;
  aggregateId?: string;
  /** Inclusive London days, `YYYY-MM-DD`. */
  from?: string;
  to?: string;
};

export function auditLogQueryString(params: AdminAuditLogParams): string {
  const qs = new URLSearchParams();
  qs.set("limit", String(params.limit ?? 50));
  qs.set("offset", String(params.offset ?? 0));
  if (params.q) qs.set("q", params.q);
  if (params.actorUserId) qs.set("actorUserId", params.actorUserId);
  if (params.view) qs.set("view", params.view);
  if (params.eventTypes?.length) qs.set("eventTypes", params.eventTypes.join(","));
  if (params.aggregateType) qs.set("aggregateType", params.aggregateType);
  if (params.aggregateId) qs.set("aggregateId", params.aggregateId);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  return qs.toString();
}

/** The staff audit log: filtered, newest first, with the total for paging. */
export async function getAdminAuditLog(
  params: AdminAuditLogParams,
): Promise<{ rows: AdminAuditLogRow[]; total: number }> {
  const res = await authedServerFetch(`/admin/audit/log?${auditLogQueryString(params)}`);
  if (!res.ok) {
    throw new Error(res.status === 403 ? "forbidden" : `Audit log unavailable: ${res.status}`);
  }
  const body = await readJsonBody(res);
  return readListEnvelope(body, adminAuditLogRowSchema, "GET /admin/audit/log");
}

/** People who appear in the audit log, for the actor filter. */
export async function searchAdminAuditActors(params: {
  q?: string;
  limit?: number;
}): Promise<AdminAuditActorOption[]> {
  const qs = new URLSearchParams();
  qs.set("limit", String(params.limit ?? 20));
  if (params.q) qs.set("q", params.q);
  const res = await authedServerFetch(`/admin/audit/actors?${qs.toString()}`);
  if (!res.ok) throw new Error(`Failed to search actors: ${res.status}`);
  const body = await readJsonBody(res);
  return readListEnvelope(body, adminAuditActorOptionSchema, "GET /admin/audit/actors").rows;
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
  const body = await readJsonBody(res);
  const { rows } = readListEnvelope(
    body,
    adminDomainEventRowSchema,
    "GET /admin/finance/dispute-domain-events",
  );
  return rows;
}

/** Events of a single entity (lot, sale, etc.), newest first, each with its actor. */
export async function getAdminDomainEventsForAggregate(params: {
  aggregateType: string;
  aggregateId: string;
  limit?: number;
  offset?: number;
}): Promise<AdminAuditLogRow[]> {
  const { rows } = await getAdminAuditLog({
    aggregateType: params.aggregateType,
    aggregateId: params.aggregateId,
    limit: params.limit ?? 100,
    offset: params.offset ?? 0,
  });
  return rows;
}
