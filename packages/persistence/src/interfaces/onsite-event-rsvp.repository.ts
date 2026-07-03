import type {
  OnsiteEventCheckInSearchRow,
  OnsiteEventRsvp,
  OnsiteEventRsvpAdminRow,
} from "@auction/types";

export type UpsertOnsiteEventRsvpInput = {
  eventSlug: string;
  userId: string;
  attendanceSegment: string;
  plusOne: number;
  plusOneGuestName: string | null;
  notes: string | null;
  checkInTokenHash: string;
  checkInTokenIssuedAt: Date;
  checkInTokenCiphertext: string;
};

export type UpdateOnsiteEventCheckInTokenInput = {
  checkInTokenHash: string;
  checkInTokenIssuedAt: Date;
  checkInTokenCiphertext: string;
};

export type OnsiteEventRsvpWithGuest = OnsiteEventRsvp & {
  guestName: string;
  guestEmail: string;
  checkedInByName: string | null;
};

export interface IOnsiteEventRsvpRepository {
  findByEventAndUser(eventSlug: string, userId: string): Promise<OnsiteEventRsvp | null>;
  findByIdWithGuest(rsvpId: string): Promise<OnsiteEventRsvpWithGuest | null>;
  findByTokenHash(tokenHash: string): Promise<OnsiteEventRsvpWithGuest | null>;
  listAdminRows(eventSlug: string): Promise<OnsiteEventRsvpAdminRow[]>;
  upsert(input: UpsertOnsiteEventRsvpInput): Promise<OnsiteEventRsvp>;
  updateCheckInToken(
    rsvpId: string,
    input: UpdateOnsiteEventCheckInTokenInput,
  ): Promise<OnsiteEventRsvp | null>;
  issueTokenIfMissing(
    rsvpId: string,
    tokenHash: string,
    issuedAt: Date,
  ): Promise<OnsiteEventRsvp | null>;
  atomicCheckIn(input: {
    rsvpId: string;
    staffUserId: string;
    partyCount: number;
  }): Promise<OnsiteEventRsvpWithGuest | null>;
  searchForCheckIn(
    eventSlug: string,
    query: string,
    limit?: number,
  ): Promise<OnsiteEventCheckInSearchRow[]>;
  countCheckInStats(eventSlug: string): Promise<{ total: number; checkedIn: number }>;
}
