import { LEGAL_ENTITIES } from "./legal-entity.js";

/**
 * How visitors reach the London Art Exchange gallery. The address comes from the company's
 * registered address; the phone and email are the ones published in its policies. Seeds and
 * pages read the gallery's details from here, never from a string of their own.
 */
const { postal } = LEGAL_ENTITIES["london-art-exchange"].registeredAddress;

/**
 * When the gallery is open, as one line ("Tuesday to Saturday, 10:00 to 18:00"). Null until the
 * gallery publishes its hours: pages then show no hours at all rather than a guess.
 */
const OPENING_HOURS: string | null = null;

export const GALLERY_CONTACT = {
  name: "LAX Marylebone",
  streetLine: postal.streetAddress,
  city: postal.addressLocality,
  postcode: postal.postalCode,
  /** "156 New Cavendish Street, London". */
  address: `${postal.streetAddress}, ${postal.addressLocality}`,
  phone: "+44 20 8044 1334",
  phoneHref: "tel:+442080441334",
  email: "info@thelax.art",
  openingHours: OPENING_HOURS,
} as const;
