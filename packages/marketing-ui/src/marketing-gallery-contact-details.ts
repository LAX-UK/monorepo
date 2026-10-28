import type { MarketingGalleryTeamDetail } from "./marketing-gallery-team-band.js";

/** How visitors reach the gallery; `openingHours` is null when no hours are published. */
export type MarketingGalleryContact = {
  streetLine: string;
  city: string;
  postcode: string;
  phone: string;
  phoneHref: string;
  email: string;
  openingHours: string | null;
};

const GOOGLE_MAPS_SEARCH = "https://www.google.com/maps/search/?api=1&query=";

function clean(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** A map search for the gallery's address, or null when the address is blank. */
function mapsHref(contact: MarketingGalleryContact): string | null {
  const query = [contact.streetLine, contact.city, contact.postcode]
    .map(clean)
    .filter((part): part is string => part !== null)
    .join(", ");
  return query ? `${GOOGLE_MAPS_SEARCH}${encodeURIComponent(query)}` : null;
}

/**
 * The gallery's direct lines for `MarketingGalleryTeamBand`, in the same order in every product:
 * phone, email, the address with a map link, then the opening hours. Without published hours the
 * hours line is left out.
 */
export function marketingGalleryContactDetails(
  contact: MarketingGalleryContact,
): MarketingGalleryTeamDetail[] {
  const mapHref = mapsHref(contact);
  const hours = contact.openingHours?.trim();
  return [
    { kind: "phone", text: contact.phone, href: contact.phoneHref },
    { kind: "email", text: contact.email, href: `mailto:${contact.email}` },
    {
      kind: "address",
      text: `${contact.streetLine}, ${contact.city} ${contact.postcode}`,
      ...(mapHref ? { href: mapHref } : {}),
    },
    ...(hours ? [{ kind: "hours" as const, text: hours }] : []),
  ];
}
