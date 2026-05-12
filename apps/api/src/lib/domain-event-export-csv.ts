import type { RedactedDomainEventRow } from "../services/interfaces/admin-routes.js";

function esc(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** Serialize redacted domain event rows for CSV download (presentation only). */
export function formatDomainEventsExportCsv(rows: RedactedDomainEventRow[]): string {
  const header =
    "id,aggregate_type,aggregate_id,event_type,actor_user_id,acting_legal_entity_id,occurred_at,payload_json\n";
  const body = rows
    .map((r) =>
      [
        String(r.id),
        esc(r.aggregateType),
        esc(r.aggregateId),
        esc(r.eventType),
        esc(r.actorUserId ?? ""),
        esc(r.actingLegalEntityId ?? ""),
        esc(r.occurredAt.toISOString()),
        esc(JSON.stringify(r.payload)),
      ].join(","),
    )
    .join("\n");
  return header + body;
}
