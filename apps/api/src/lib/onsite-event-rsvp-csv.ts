import type { OnsiteEvent, OnsiteEventRsvpAdminRow } from "@auction/types";
import { segmentLabelFor } from "./onsite-event.mapper.js";

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function onsiteEventRsvpsToCsv(event: OnsiteEvent, rows: OnsiteEventRsvpAdminRow[]): string {
  const header = [
    "name",
    "email",
    "attendance_segment",
    "plus_one",
    "guest_name",
    "notes",
    "updated_at",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        escapeCsv(row.name),
        escapeCsv(row.email),
        escapeCsv(segmentLabelFor(event, row.attendanceSegment)),
        String(row.plusOne),
        escapeCsv(row.plusOneGuestName ?? ""),
        escapeCsv(row.notes ?? ""),
        escapeCsv(row.updatedAt),
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}
