import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";

/** The page where the offered bidder reviews, accepts or declines one offer, or reads how it ended. */
export function bidderReofferHref(reofferId: string): string {
  return `${CLIENT_ROUTES.bids}/offers/${encodeURIComponent(reofferId)}`;
}

/**
 * Opens the offer for a lot in the account in use. A notice names the lot, not the offer, so this
 * address finds the offer and goes to its page.
 */
export function bidderReofferForLotHref(lotId: string): string {
  return `${CLIENT_ROUTES.bids}/offers/lot/${encodeURIComponent(lotId)}`;
}

/**
 * A late accept comes back to the offer's page with this mark, so the page can say the offer
 * ended while the person was answering. The mark is only a message: it changes nothing.
 */
export const REOFFER_LATE_PARAM = "late";
