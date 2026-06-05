import type { onsiteEventRsvp } from "@auction/db/schema";
import type { OnsiteEventRsvp } from "@auction/types";

type Row = typeof onsiteEventRsvp.$inferSelect;

export function mapOnsiteEventRsvpRow(row: Row): OnsiteEventRsvp {
  return {
    id: row.id,
    eventSlug: row.eventSlug,
    userId: row.userId,
    attendanceSegment: row.attendanceSegment,
    plusOne: row.plusOne,
    plusOneGuestName: row.plusOneGuestName,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
