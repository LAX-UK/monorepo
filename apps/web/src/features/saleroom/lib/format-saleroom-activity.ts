import type { SaleroomActivityEntry } from "@/features/saleroom/types/staff-saleroom.vm";
import type { AdminSaleroomEventRow } from "@/lib/data/http/admin.server";
import type { SaleroomRealtimePayload } from "@auction/types";

const KIND_LABELS: Record<string, string> = {
  opened: "Session went live",
  paused: "Session paused",
  resumed: "Session resumed",
  closed: "Session closed",
  advanced_to_lot: "Lot advanced to block",
  hammer: "Hammer — sold",
  no_sale: "No sale",
};

export function formatSaleroomEventKind(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

export function formatSaleroomActivityFromSocket(
  event: SaleroomRealtimePayload,
  index: number,
): SaleroomActivityEntry {
  const lotDetail = event.lotId != null ? `Lot ${event.lotId.slice(0, 8)}…` : null;
  return {
    id: `socket-${event.emittedAt ?? "unknown"}-${index}`,
    label: formatSaleroomEventKind(event.kind),
    detail: lotDetail,
    occurredAt: event.emittedAt ?? new Date().toISOString(),
    source: "socket",
  };
}

export function formatSaleroomActivityFromDb(event: AdminSaleroomEventRow): SaleroomActivityEntry {
  return {
    id: `db-${event.id}`,
    label: formatSaleroomEventKind(event.kind),
    detail: null,
    occurredAt: event.occurredAt,
    source: "db",
  };
}

export function mergeActivityLog(
  socketEvents: SaleroomRealtimePayload[],
  dbEvents: AdminSaleroomEventRow[],
  limit = 40,
): SaleroomActivityEntry[] {
  const socketEntries = socketEvents.map((e, i) => formatSaleroomActivityFromSocket(e, i));
  const dbEntries = dbEvents.map(formatSaleroomActivityFromDb);
  const seen = new Set<string>();
  const merged: SaleroomActivityEntry[] = [];

  for (const entry of [...socketEntries, ...dbEntries]) {
    const key = `${entry.label}-${entry.occurredAt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(entry);
  }

  return merged
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, limit);
}
