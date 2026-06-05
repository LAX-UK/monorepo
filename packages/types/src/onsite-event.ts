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
  status: OnsiteEventStatus;
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
};

export type OnsiteEventPublicConfig = {
  slug: string;
  title: string;
  segmentOptions: OnsiteEventSegmentOption[];
  rsvpOpen: boolean;
  rsvpCloseAt: string | null;
  micrositeUrl: string | null;
};

export type OnsiteEventRsvp = {
  id: string;
  eventSlug: string;
  userId: string;
  attendanceSegment: string;
  plusOne: number;
  plusOneGuestName: string | null;
  notes: string | null;
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
  createdAt: string;
  updatedAt: string;
};
