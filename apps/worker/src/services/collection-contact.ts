import { GALLERY_CONTACT } from "@auction/branding";
import type { StoredLot } from "../interfaces/collect-by.reader.js";

/**
 * How a buyer reaches the place a lot waits at: its collections email (the gallery's when the
 * place has none) and its venue phone. A venue with no phone gives none, never a placeholder.
 */
export function placeContact(place: StoredLot["place"]): {
  contactEmail: string;
  contactPhone: string | null;
} {
  return {
    contactEmail: place.bookingEmail?.trim() || GALLERY_CONTACT.email,
    contactPhone: place.phone?.trim() || null,
  };
}
