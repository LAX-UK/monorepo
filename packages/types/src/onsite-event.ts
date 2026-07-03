export type OnsiteEventSegmentOption = {
  value: string;
  label: string;
  helper?: string;
};

export type OnsiteEventStatus = "draft" | "published" | "closed";

export type OnsiteEvent = {
  slug: string;
  title: string;
  startsAt: Date | null;
  rsvpCloseAt: Date | null;
  segmentOptions: OnsiteEventSegmentOption[];
  opsEmail: string | null;
  micrositeUrl: string | null;
  venue: string | null;
  dressCode: string | null;
  arrivalNote: string | null;
  status: OnsiteEventStatus;
  checkInDryRun: boolean;
  /** Linked onsite/hybrid sale for advance check-in / paddle express lane. */
  saleId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OnsiteEventListItem = {
  slug: string;
  title: string;
  startsAt: string | null;
  rsvpCloseAt: string | null;
  status: OnsiteEventStatus;
  rsvpCount: number;
  saleId: string | null;
};

export type OnsiteEventAdminDetail = {
  slug: string;
  title: string;
  status: OnsiteEventStatus;
  startsAt: string | null;
  rsvpCloseAt: string | null;
  segmentOptions: OnsiteEventSegmentOption[];
  micrositeUrl: string | null;
  venue: string | null;
  dressCode: string | null;
  arrivalNote: string | null;
  opsEmail: string | null;
  checkInDryRun: boolean;
  rsvpCount: number;
  checkedInCount: number;
  saleId: string | null;
};

export type OnsiteEventPublicConfig = {
  slug: string;
  title: string;
  segmentOptions: OnsiteEventSegmentOption[];
  rsvpOpen: boolean;
  rsvpCloseAt: string | null;
  micrositeUrl: string | null;
  startsAt: string | null;
  venue: string | null;
  dressCode: string | null;
  arrivalNote: string | null;
  opsEmail: string | null;
  saleId: string | null;
  linkedSaleTitle: string | null;
  status: "published" | "closed";
};

export type OnsiteEventPublicListItem = {
  slug: string;
  title: string;
  startsAt: string | null;
  venue: string | null;
  dressCode: string | null;
  micrositeUrl: string | null;
  deliveryMode: "onsite" | "hybrid" | null;
};

export type OnsiteEventRsvp = {
  id: string;
  eventSlug: string;
  userId: string;
  attendanceSegment: string;
  plusOne: number;
  plusOneGuestName: string | null;
  notes: string | null;
  checkInTokenHash: string | null;
  checkInTokenIssuedAt: Date | null;
  checkInTokenCiphertext: string | null;
  checkedInAt: Date | null;
  checkedInByUserId: string | null;
  checkInPartyCount: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OnsiteEventExistingRsvp = {
  attendanceSegment: string;
  plusOne: number;
  plusOneGuestName: string | null;
  notes: string | null;
  updatedAt: string;
};

export type OnsiteEventEmailLookup =
  | { status: "event_closed" }
  | { status: "not_registered" }
  | { status: "suspended" }
  | {
      status: "ready";
      user: { name: string; email: string };
      segmentOptions: OnsiteEventSegmentOption[];
      existingRsvp?: OnsiteEventExistingRsvp;
    };

export type OnsiteEventRsvpAdminRow = {
  id: string;
  name: string;
  email: string;
  attendanceSegment: string;
  plusOne: number;
  plusOneGuestName: string | null;
  notes: string | null;
  checkedInAt: string | null;
  checkInPartyCount: number | null;
  createdAt: string;
  updatedAt: string;
};

export type OnsiteEventCheckInResultCode =
  | "VALID"
  | "DRY_RUN_VALID"
  | "ALREADY_CHECKED_IN"
  | "INVALID"
  | "WRONG_EVENT"
  | "EVENT_CLOSED";

export type OnsiteEventCheckInLogResult = OnsiteEventCheckInResultCode | "PASS_RESENT";

export type OnsiteEventCheckInGuestSummary = {
  rsvpId: string;
  name: string;
  email: string;
  attendanceSegment: string;
  attendanceSegmentLabel: string;
  plusOne: number;
  plusOneGuestName: string | null;
  partySize: number;
  checkedInAt: string | null;
  checkedInByName: string | null;
};

export type OnsiteEventCheckInResult =
  | { status: "VALID"; guest: OnsiteEventCheckInGuestSummary }
  | { status: "DRY_RUN_VALID"; guest: OnsiteEventCheckInGuestSummary }
  | { status: "ALREADY_CHECKED_IN"; guest: OnsiteEventCheckInGuestSummary }
  | { status: "INVALID" }
  | { status: "WRONG_EVENT" }
  | { status: "EVENT_CLOSED" };

export type OnsiteEventCheckInSearchRow = {
  rsvpId: string;
  name: string;
  email: string;
  attendanceSegment: string;
  attendanceSegmentLabel: string;
  plusOne: number;
  plusOneGuestName: string | null;
  checkedInAt: string | null;
};

export type OnsiteEventPassView = {
  slug: string;
  title: string;
  guestName: string;
  attendanceSegment: string;
  attendanceSegmentLabel: string;
  plusOne: number;
  plusOneGuestName: string | null;
  partySize: number;
  startsAt: string | null;
  venue: string | null;
  dressCode: string | null;
  passUrl: string;
  qrImageUrl: string;
  checkedInAt: string | null;
  eventClosed: boolean;
  /** Assigned in-room paddle when the linked sale has checked the guest in. */
  paddleNumber: number | null;
};

export type OnsiteEventSubmitRsvpResponse = {
  id: string;
  eventSlug: string;
  userId: string;
  attendanceSegment: string;
  plusOne: number;
  plusOneGuestName: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  passUrl: string;
};
