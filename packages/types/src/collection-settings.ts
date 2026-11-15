/**
 * What the staff collection settings API sends. Times of day are London wall-clock "HH:MM";
 * days are London dates "2026-12-24"; instants are ISO 8601 (UTC).
 */

export type StaffCollectionVenue = {
  venueId: string;
  name: string;
  /** Set up already, or still on the defaults. */
  hasPlace: boolean;
  onlineBookingEnabled: boolean;
};

export type StaffCollectionHours = { weekday: number; opensLocal: string; closesLocal: string };

export type StaffCollectionException = {
  /** `null` for a sale day: it is worked out from the sale, so it can only be opened anyway. */
  id: string | null;
  kind: "closure" | "extra_opening";
  startsOn: string;
  endsOn: string;
  opensLocal: string | null;
  closesLocal: string | null;
  source: "staff" | "bank_holiday" | "sale";
  /** Staff's own note. */
  reason: string | null;
  saleTitle: string | null;
  /** A stored closure or opening can be removed; a sale day cannot. */
  canRemove: boolean;
};

export type StaffCollectionSettings = {
  venueId: string;
  /** The settings as last saved; send it back with a save so a change made meanwhile is noticed. */
  version: string;
  onlineBookingEnabled: boolean;
  bookingEmail: string | null;
  visitMinutes: number;
  placesPerSlot: number;
  noticeCutoffLocal: string;
  noticeWorkingDays: number;
  windowDays: number;
  closeOnSaleDays: boolean;
  undoHandOverMinutes: number;
  maxActiveVisits: number;
  freeStorageDays: number | null;
  hours: StaffCollectionHours[];
  /** Closures and extra openings from today on, earliest first. */
  exceptions: StaffCollectionException[];
  /** The next sale at the place that closes collections, if any. */
  nextSaleDay: { saleTitle: string; startsOn: string } | null;
};

/** A booking a change would leave outside what the place offers. */
export type StaffAffectedBooking = {
  bookingId: string;
  reference: string;
  start: string;
  end: string;
  reason: "closed" | "outside_hours" | "over_capacity";
};

/** What a save or a closure did to the bookings it touched. */
export type StaffCollectionChangeResult = {
  settings: StaffCollectionSettings;
  /** Bookings the change left outside the offer, and what happened to them. */
  affected: StaffAffectedBooking[];
  cancelled: number;
};
