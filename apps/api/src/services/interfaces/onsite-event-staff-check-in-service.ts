import type { OnsiteEventCheckInResult, OnsiteEventCheckInSearchRow } from "@auction/types";
import type { OnsiteEventCheckInServiceError } from "./onsite-event-service-errors.js";

export interface IOnsiteEventStaffCheckInService {
  checkIn(
    eventSlug: string,
    input: { token?: string; rsvpId?: string },
    staffUserId: string,
  ): Promise<OnsiteEventCheckInResult>;
  searchGuests(
    eventSlug: string,
    query: string,
  ): Promise<OnsiteEventCheckInSearchRow[] | OnsiteEventCheckInServiceError>;
  getCheckInStats(
    eventSlug: string,
  ): Promise<
    { total: number; checkedIn: number; checkInDryRun: boolean } | OnsiteEventCheckInServiceError
  >;
  recordPassResend(eventSlug: string, rsvpId: string, staffUserId: string): Promise<void>;
}
