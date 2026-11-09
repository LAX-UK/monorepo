import type { TemplateDomainSlice } from "./shared.js";

const names = [
  "collection-booked",
  "collection-changed",
  "collection-cancelled",
  "collection-reminder",
  "collection-collector-notice",
] as const;

type CollectionTemplateName = (typeof names)[number];

/** The calendar file that travels with a booking email (RFC 5545), attached as it is. */
export type CollectionCalendarAttachment = {
  filename: string;
  /** `REQUEST` adds or updates the entry; `CANCEL` removes it. */
  method: "REQUEST" | "CANCEL";
  content: string;
};

/** What every email about one visit says about it. Never a price. */
type VisitVars = {
  userName?: string | null;
  /** "COL-4821". */
  reference: string;
  /** The visit in the one date style: "Thu 12 Nov, 14:00–14:30 GMT". */
  whenLabel: string;
  placeName: string;
  /** The gallery's address, one line. */
  address: string;
  /** One line per lot: "Lot 12 · Lowland Storm". */
  lots: string[];
  collectorName: string;
  /** Someone other than the person the email is for is coming. */
  collectorIsOther: boolean;
  /** Where the buyer sees, changes or cancels the visit. */
  bookingUrl: string;
  calendar?: CollectionCalendarAttachment | null;
};

type CollectionTemplateVars = {
  "collection-booked": VisitVars & {
    /** "Wed 11 Nov, 16:00 GMT": the last moment to change or cancel online. */
    changeUntilLabel?: string | null;
    /** "Tue 8 Dec": the day to collect by, when the place sets one. */
    collectByLabel?: string | null;
  };
  "collection-changed": VisitVars & {
    previousWhenLabel: string;
    changeUntilLabel?: string | null;
  };
  "collection-cancelled": {
    userName?: string | null;
    reference: string;
    /** The day that was booked: "Thu 12 Nov". */
    dayLabel: string;
    lots: string[];
    /**
     * Who ended it: the buyer, the gallery (hours or a closure changed), or the account (the
     * person who booked has left, so the visit cannot go ahead).
     */
    cancelledBy: "buyer" | "gallery" | "account";
    /** For the gallery's own reason: "we are closed that day". */
    reasonText?: string | null;
    /** Where to book another time. */
    bookUrl: string;
    calendar?: CollectionCalendarAttachment | null;
  };
  "collection-reminder": VisitVars & {
    /** "14:00 GMT". */
    timeLabel: string;
    changeUntilLabel?: string | null;
  };
  /** To the person named to collect: the time, the place and the ID rule. */
  "collection-collector-notice": {
    collectorName: string;
    bookerName: string;
    reference: string;
    whenLabel: string;
    dayLabel: string;
    placeName: string;
    address: string;
    /** Lot titles only. */
    lots: string[];
    calendar?: CollectionCalendarAttachment | null;
  };
};

export const collectionTemplates = {
  names,
  vars: {} as CollectionTemplateVars,
  recipientResolution: {
    "collection-booked": "live",
    "collection-changed": "live",
    "collection-cancelled": "live",
    "collection-reminder": "live",
    // The collector may have no account: the address is the one the buyer typed.
    "collection-collector-notice": "snapshot",
  },
} satisfies TemplateDomainSlice<CollectionTemplateName, CollectionTemplateVars>;

export type { CollectionTemplateName, CollectionTemplateVars };
