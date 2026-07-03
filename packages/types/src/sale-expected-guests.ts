import type { OnsiteEventSegmentOption } from "./onsite-event.js";

export type SaleExpectedGuestEntity = {
  id: string;
  displayName: string;
  role: string;
  kind: string;
  existingRegistration: {
    status: string;
    paddleNumber: number | null;
    bidLimit: string | null;
    checkedInAt: string | null;
  } | null;
};

export type SaleExpectedGuestRow = {
  rsvpId: string;
  userId: string;
  name: string | null;
  email: string;
  attendanceSegment: string;
  galaCheckedInAt: string | null;
  plusOne: number;
  kycApproved: boolean;
  emailVerified: boolean;
  suspended: boolean;
  eligibleEntities: SaleExpectedGuestEntity[];
  /** Best-effort sale registration summary when exactly one eligible entity has a row. */
  saleRegistration: {
    registrationId: string;
    status: string;
    paddleNumber: number | null;
    checkedInAt: string | null;
  } | null;
};

export type SaleExpectedGuestsSummary = {
  eventSlug: string | null;
  eventTitle: string | null;
  segmentOptions: OnsiteEventSegmentOption[];
  items: SaleExpectedGuestRow[];
  counts: {
    rsvped: number;
    galaCheckedIn: number;
    salePresent: number;
    paddled: number;
  };
};
