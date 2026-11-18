import { type LocationRef, locationLabel } from "@auction/artwork-register-contracts";

/**
 * The Zoho Products text field LAX fills with where an original physically is. LAX writes it and
 * nothing else for the location; Zoho users see it read-only (field permissions in Zoho).
 * Design: docs/design/stock-location.md section 5.
 */
export const ZOHO_LOCATION_FIELD = "LAX_Location";

/** Zoho's text field holds 255 characters. */
export const ZOHO_LOCATION_MAX = 255;

/**
 * What the Product should show: the location as LAX Admin reads it (a retired one is marked), or
 * null when no location has been recorded, so the field stays empty.
 */
export function zohoLocationValue(location: LocationRef | null): string | null {
  if (!location) return null;
  return [...locationLabel(location)].slice(0, ZOHO_LOCATION_MAX).join("");
}
