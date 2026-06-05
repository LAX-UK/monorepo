import type {
  OnsiteEventCheckInResult,
  OnsiteEventCheckInSearchRow,
  OnsiteEventPassView,
} from "@auction/types";

export type OnsiteEventCheckInServiceError = {
  message: string;
  status: number;
  code?: string;
};

export interface IOnsiteEventCheckInService {
  getPassView(
    eventSlug: string,
    plainToken: string,
    apiBaseUrl: string,
  ): Promise<OnsiteEventPassView | OnsiteEventCheckInServiceError>;
  renderPassQrSvg(passUrl: string): Promise<string>;
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
