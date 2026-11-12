import type { ReofferStatus } from "@auction/domain";
import type { StatusPresentation } from "@auction/staff-ui";

/** How staff read each state of an offer: one entry per state, so a new state cannot be missed. */
export const REOFFER_STATUS_PRESENTATION: Record<ReofferStatus, StatusPresentation> = {
  awaiting_seller: { label: "Waiting for the seller", tone: "warning" },
  ready: { label: "Ready to send", tone: "info" },
  offered: { label: "Offer sent", tone: "info" },
  accepted: { label: "Accepted", tone: "success" },
  declined: { label: "Declined", tone: "neutral" },
  expired: { label: "Offer ended", tone: "neutral" },
  seller_declined: { label: "Seller declined", tone: "neutral" },
  seller_lapsed: { label: "No reply from the seller", tone: "warning" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

/** The lot header's meta line, while an offer is open or has just closed. */
export const REOFFER_META_LABEL: Record<ReofferStatus, string> = {
  awaiting_seller: "waiting for the seller",
  ready: "ready to send",
  offered: "offer sent",
  accepted: "accepted",
  declined: "declined",
  expired: "offer ended",
  seller_declined: "seller declined",
  seller_lapsed: "no reply from the seller",
  withdrawn: "withdrawn",
};

/** What the seller said they would like done with the lot, in words for staff. */
export const SELLER_PREFERENCE_LABEL: Record<string, string> = {
  later_sale: "include it in a later sale",
  return_to_me: "return it to them",
  talk_to_us: "talk to us",
};
