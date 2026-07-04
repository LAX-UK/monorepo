import type { OnsiteEventRsvpWithGuest } from "@auction/persistence";
import type { OnsiteEvent, OnsiteEventCheckInGuestSummary } from "@auction/types";
import { segmentLabelFor } from "./onsite-event.mapper.js";

export function partySize(rsvp: { plusOne: number }): number {
  return 1 + rsvp.plusOne;
}

export function mapGuestSummary(
  event: OnsiteEvent,
  rsvp: OnsiteEventRsvpWithGuest,
): OnsiteEventCheckInGuestSummary {
  return {
    rsvpId: rsvp.id,
    name: rsvp.guestName,
    email: rsvp.guestEmail,
    attendanceSegment: rsvp.attendanceSegment,
    attendanceSegmentLabel: segmentLabelFor(event, rsvp.attendanceSegment),
    plusOne: rsvp.plusOne,
    plusOneGuestName: rsvp.plusOneGuestName,
    partySize: partySize(rsvp),
    checkedInAt: rsvp.checkedInAt?.toISOString() ?? null,
    checkedInByName: rsvp.checkedInByName,
  };
}
