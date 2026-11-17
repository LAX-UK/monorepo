/**
 * The lot page with its bid dialog open; the page re-checks every rule before it opens. Shared by
 * the card's "Leave a bid" button and the outbid bidder's "Bid £X", in a module of its own so the
 * card button does not pull the bidder state component into a bundle.
 */
export function lotBidHref(lotHref: string): string {
  return `${lotHref}${lotHref.includes("?") ? "&" : "?"}bid=open`;
}
