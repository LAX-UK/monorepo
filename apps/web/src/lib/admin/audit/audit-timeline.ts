import { domainEventLabel } from "@/lib/admin/domain-event-labels";
import { isoDate } from "@/lib/admin/iso-date";
import type { AdminAuditActor, AdminDomainEventRow } from "@/lib/data/http/admin-audit.schema";
import { type TimelineEvent, formatStaffDateTime } from "@auction/staff-ui";
import { buildAuditEventDetail, summariseAuditEvent } from "./audit-event-detail";
import { auditActionTone } from "./audit-log.vm";

type TimelineSource = AdminDomainEventRow & { actor?: AdminAuditActor | null };

function actorLabel(row: TimelineSource): string {
  if (!row.actorUserId) return "System";
  const name = row.actor?.name?.trim();
  if (name) return name;
  return row.actor?.kind === "client" ? "A client" : "Staff member";
}

/**
 * Domain events as kit timeline events, newest first. The one place the lot and sale activity
 * views, and any other record's activity, turn an audit row into a sentence.
 */
export function toTimelineEvents(rows: readonly TimelineSource[]): TimelineEvent[] {
  return [...rows]
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .map((row) => {
      const summary = summariseAuditEvent(buildAuditEventDetail(row.payload, formatStaffDateTime));
      return {
        id: row.id,
        title: domainEventLabel(row.eventType),
        at: isoDate(row.occurredAt),
        actor: actorLabel(row),
        tone: auditActionTone(row.eventType),
        ...(summary ? { detail: summary } : {}),
      };
    });
}
