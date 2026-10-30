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

/** The list's tabs: the lead statuses, plus leads who went on to open a LAX account. */
export const GUEST_LEAD_TABS = [
  "all",
  "ordered",
  "abandoned_checkout",
  "enquired",
  "joined",
] as const;

export type GuestLeadTab = (typeof GUEST_LEAD_TABS)[number];

export const GUEST_LEAD_TAB_LABEL = {
  all: "All",
  ordered: "Ordered",
  abandoned_checkout: "Abandoned checkout",
  enquired: "Enquired",
  joined: "Joined LAX",
} as const satisfies Record<GuestLeadTab, string>;

/** Where a lead stands with the CRM. */
export const GUEST_LEAD_CRM_STATES = ["synced", "pending", "failed", "not_sent"] as const;

export type GuestLeadCrmState = (typeof GUEST_LEAD_CRM_STATES)[number];

export const GUEST_LEAD_CRM_STATE_LABEL = {
  synced: "In CRM",
  pending: "Sending",
  failed: "Failed",
  not_sent: "Not sent",
} as const satisfies Record<GuestLeadCrmState, string>;

/** The CRM integration's delivery states for one event, as its delivery ledger records them. */
export type CrmDeliveryStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "skipped"
  | "retryable"
  | "dead_lettered";

/**
 * What each CRM state means, as one table: a lead is in the CRM once the CRM has a record for it;
 * until then the latest delivery of its lead event says whether it is on its way, has failed, or
 * was never sent (lead sync is off). Readers that filter by state build their query from this.
 */
export const GUEST_LEAD_CRM_STATE_MATCH: Readonly<
  Record<
    GuestLeadCrmState,
    { hasCrmRecord: boolean; deliveries?: readonly (CrmDeliveryStatus | null)[] }
  >
> = {
  synced: { hasCrmRecord: true },
  pending: { hasCrmRecord: false, deliveries: ["pending", "processing", "retryable"] },
  failed: { hasCrmRecord: false, deliveries: ["dead_lettered"] },
  not_sent: { hasCrmRecord: false, deliveries: ["succeeded", "skipped", null] },
};

export function guestLeadCrmState(input: {
  hasCrmRecord: boolean;
  latestDelivery: CrmDeliveryStatus | null;
}): GuestLeadCrmState {
  const match = GUEST_LEAD_CRM_STATES.find((state) => {
    const rule = GUEST_LEAD_CRM_STATE_MATCH[state];
    if (rule.hasCrmRecord !== input.hasCrmRecord) return false;
    return rule.deliveries === undefined || rule.deliveries.includes(input.latestDelivery);
  });
  return match ?? "not_sent";
}
