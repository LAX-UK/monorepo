import type { OnsiteEventRsvp, OnsiteEventRsvpAdminRow } from "@auction/types";

export type UpsertOnsiteEventRsvpInput = {
  eventSlug: string;
  userId: string;
  attendanceSegment: string;
  plusOne: number;
  plusOneGuestName: string | null;
  notes: string | null;
};

export interface IOnsiteEventRsvpRepository {
  findByEventAndUser(eventSlug: string, userId: string): Promise<OnsiteEventRsvp | null>;
  listAdminRows(eventSlug: string): Promise<OnsiteEventRsvpAdminRow[]>;
  upsert(input: UpsertOnsiteEventRsvpInput): Promise<OnsiteEventRsvp>;
}
