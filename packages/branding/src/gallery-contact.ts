import { LEGAL_ENTITIES } from "./legal-entity.js";

/**
 * How visitors reach the London Art Exchange gallery. The address comes from the company's
 * registered address; the phone and email are the ones published in its policies. Seeds and
 * pages read the gallery's details from here, never from a string of their own.
 */
const { postal } = LEGAL_ENTITIES["london-art-exchange"].registeredAddress;

/** When the gallery is open, as one line. */
const OPENING_HOURS = "Monday to Friday, 10:00 to 19:00. Closed at weekends.";

export const GALLERY_CONTACT = {
  name: "LAX Marylebone",
  streetLine: postal.streetAddress,
  city: postal.addressLocality,
  postcode: postal.postalCode,
  /** "156 New Cavendish Street, London". */
  address: `${postal.streetAddress}, ${postal.addressLocality}`,
  phone: "+44 800 208 4800",
  phoneHref: "tel:+448002084800",
  email: "info@thelax.art",
  openingHours: OPENING_HOURS,
} as const;
