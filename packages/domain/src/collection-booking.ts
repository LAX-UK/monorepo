/**
 * How a buyer books a time to collect a work from the saleroom.
 *
 * Self-serve booking (pick a slot, name who collects) opens only when operations have set the
 * saleroom's hours and capacity and switched it on. Until then the buyer gets the address, the
 * hours when known, and an email address to book by, which is what the team handles today.
 */
export type CollectionBookingSettings = {
  /** The feature switch; off until operations confirm hours and capacity. */
  selfServeEnabled: boolean;
  /** Slots that can be booked per hour; self-serve needs a positive capacity. */
  slotCapacityPerHour: number | null;
  /** The opening hours as published, or `null` when not confirmed. */
  hours: string | null;
  /** The address bookings go to by email. */
  bookingEmail: string;
};

export type CollectionBookingOffer =
  | { kind: "self_serve"; hours: string; place: string | null }
  | { kind: "email"; email: string; hours: string | null; place: string | null };

/**
 * The booking route for a work collected from `place` (the sale's venue, one line). Self-serve
 * needs the switch, published hours and a capacity; anything less falls back to email, so a
 * half-configured saleroom never offers slots it cannot honour.
 */
export function collectionBookingOffer(
  settings: CollectionBookingSettings,
  place: string | null,
): CollectionBookingOffer {
  const { selfServeEnabled, slotCapacityPerHour, hours, bookingEmail } = settings;
  if (selfServeEnabled && hours && slotCapacityPerHour && slotCapacityPerHour > 0) {
    return { kind: "self_serve", hours, place };
  }
  return { kind: "email", email: bookingEmail, hours, place };
}

/** The rules of a place that the offer needs: the online-booking switch and its capacity. */
export type CollectionPlaceForOffer = {
  onlineBookingEnabled: boolean;
  visitMinutes: number;
  placesPerSlot: number;
  bookingEmail: string | null;
};

/**
 * The offer's settings once a place has been set up in Bid admin: its switch, capacity and hours
 * replace the environment's. Capacity is stated per hour, so 30-minute visits at 2 places are 4
 * an hour. A place with no email of its own keeps the fallback's. Before a place is set up the
 * environment settings stand, so nothing changes until staff switch booking on.
 */
export function collectionSettingsFromPlace(
  place: CollectionPlaceForOffer,
  hours: string | null,
  fallback: CollectionBookingSettings,
): CollectionBookingSettings {
  return {
    selfServeEnabled: place.onlineBookingEnabled,
    slotCapacityPerHour: place.placesPerSlot * Math.floor(60 / place.visitMinutes),
    hours,
    bookingEmail: place.bookingEmail ?? fallback.bookingEmail,
  };
}
