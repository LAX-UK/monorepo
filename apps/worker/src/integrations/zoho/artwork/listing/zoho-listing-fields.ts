/**
 * The four Zoho Products fields LAX fills to say where an artwork is. LAX writes them and nothing
 * else on the Product for the listing; Zoho users see them read-only (field permissions in Zoho).
 */
export const ZOHO_LISTING_FIELDS = {
  value: "LAX_Listing",
  detail: "LAX_Listing_Detail",
  link: "LAX_Listing_Link",
  updated: "LAX_Listing_Updated",
} as const;

/** Zoho's text field holds 255 characters. */
export const ZOHO_LISTING_DETAIL_MAX = 255;

/** What LAX wants the Product to show. Detail and link are null when there is nothing to say. */
export type ZohoListing = {
  value: string;
  detail: string | null;
  link: string | null;
};

/** What the Product shows now. */
export type ZohoListingState = {
  value: string | null;
  detail: string | null;
  link: string | null;
  updatedAt: Date | null;
};

/** Zoho reads and writes date-times as ISO 8601 with an offset and no fraction. */
export function formatZohoDateTime(value: Date): string {
  return `${value.toISOString().slice(0, 19)}+00:00`;
}
