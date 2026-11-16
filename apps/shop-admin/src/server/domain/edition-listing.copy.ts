import type { EditionListingStatus } from "@auction/shop-domain";

/** Every listing status, so a new one fails to compile until it has a staff label. */
export const EDITION_LISTING_LABELS: Record<EditionListingStatus, string> = {
  not_authorised: "Not authorised",
  authorised: "Available",
  reserved: "Reserved",
  held: "Held",
  sold: "Sold",
  withdrawn: "Withdrawn",
};
