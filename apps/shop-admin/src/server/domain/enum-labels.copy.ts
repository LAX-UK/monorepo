import type {
  ArtistApplicationAction,
  EditionListingStatus,
  ShopRefundSource,
} from "@auction/shop-domain";

/**
 * Staff words for machine values that reach LAX Admin screens. Each map covers every value of its
 * set (the test fails on any value without a label), so a code such as `stripe_dashboard` is never
 * shown as it is stored.
 */

/** Where a refund came from, on the order's Refunds list. */
export const REFUND_SOURCE_LABELS: Record<ShopRefundSource, string> = {
  admin: "Refunded by staff",
  cancellation: "Cancelled after possession",
  stripe_dashboard: "Refunded in Stripe",
};

/** The label for a refund's source; a value the app does not know yet says so plainly. */
export function refundSourceLabel(source: string): string {
  return REFUND_SOURCE_LABELS[source as ShopRefundSource] ?? "Other refund";
}

/** Every listing status, so a new one fails to compile until it has a staff label. */
export const EDITION_LISTING_LABELS: Record<EditionListingStatus, string> = {
  not_authorised: "Not authorised",
  authorised: "Available",
  reserved: "Reserved",
  held: "Held",
  sold: "Sold",
  withdrawn: "Withdrawn",
};

/** Each artist-application history event as a sentence; `assignee` is the reviewer's name, if any. */
export const ARTIST_APPLICATION_EVENT_TITLES: Record<
  ArtistApplicationAction,
  (assignee: string | null) => string
> = {
  submit: () => "Application sent",
  resubmit: () => "The artist answered and sent it back",
  assign: (assignee) => (assignee ? `Assigned to ${assignee}` : "Reviewer removed"),
  request_info: () => "Asked the artist for more information",
  accept: () => "Accepted",
  decline: () => "Declined",
};
