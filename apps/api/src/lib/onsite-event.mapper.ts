import type { onsiteEvent } from "@auction/db/schema";
import type { OnsiteEvent, OnsiteEventSegmentOption, OnsiteEventStatus } from "@auction/types";

type Row = typeof onsiteEvent.$inferSelect;

const STATUSES = new Set<OnsiteEventStatus>(["draft", "published", "closed"]);

function parseSegmentOptions(value: unknown): OnsiteEventSegmentOption[] {
  if (!Array.isArray(value)) return [];
  const options: OnsiteEventSegmentOption[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const row = item as Record<string, unknown>;
    if (typeof row.value !== "string" || typeof row.label !== "string") continue;
    options.push({
      value: row.value,
      label: row.label,
      ...(typeof row.helper === "string" ? { helper: row.helper } : {}),
    });
  }
  return options;
}

function parseStatus(value: string): OnsiteEventStatus {
  return STATUSES.has(value as OnsiteEventStatus) ? (value as OnsiteEventStatus) : "draft";
}

export function mapOnsiteEventRow(row: Row): OnsiteEvent {
  return {
    slug: row.slug,
    title: row.title,
    startsAt: row.startsAt,
    rsvpCloseAt: row.rsvpCloseAt,
    segmentOptions: parseSegmentOptions(row.segmentOptions),
    opsEmail: row.opsEmail,
    micrositeUrl: row.micrositeUrl,
    status: parseStatus(row.status),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function segmentLabelFor(event: OnsiteEvent, segmentValue: string): string {
  return event.segmentOptions.find((o) => o.value === segmentValue)?.label ?? segmentValue;
}
