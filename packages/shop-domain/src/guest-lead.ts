/**
 * A guest lead is one person without a LAX account, keyed by their normalised email: someone who
 * reached Shop checkout as a guest, or sent an enquiry without signing in. One row per email, so
 * a guest who enquires and later checks out is still one lead.
 */

/** Where the lead started. Stored on the lead and never changed afterwards. */
export const GUEST_LEAD_SOURCES = ["shop_checkout", "shop_enquiry", "art_enquiry"] as const;

export type GuestLeadSource = (typeof GUEST_LEAD_SOURCES)[number];

export const GUEST_LEAD_SOURCE_LABEL = {
  shop_checkout: "Shop guest checkout",
  shop_enquiry: "Shop enquiry",
  art_enquiry: "lax.art enquiry",
} as const satisfies Record<GuestLeadSource, string>;

/** The source of a lead first seen through an enquiry, from the storefront it was sent on. */
export function guestLeadSourceForEnquiry(salesChannel: "shop" | "art"): GuestLeadSource {
  return salesChannel === "art" ? "art_enquiry" : "shop_enquiry";
}

/**
 * Where a lead stands, furthest step first: paid for an order, reached checkout and left, or only
 * enquired.
 */
export const GUEST_LEAD_STATUSES = ["ordered", "abandoned_checkout", "enquired"] as const;

export type GuestLeadStatus = (typeof GUEST_LEAD_STATUSES)[number];

export const GUEST_LEAD_STATUS_LABEL = {
  ordered: "Ordered",
  abandoned_checkout: "Abandoned checkout",
  enquired: "Enquired",
} as const satisfies Record<GuestLeadStatus, string>;

export function guestLeadStatus(input: {
  paidOrderCount: number;
  checkoutStartedAt: Date | null;
}): GuestLeadStatus {
  if (input.paidOrderCount > 0) return "ordered";
  if (input.checkoutStartedAt) return "abandoned_checkout";
  return "enquired";
}
