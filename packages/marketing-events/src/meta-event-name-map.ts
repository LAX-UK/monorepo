/**
 * Canonical mapping from internal MarketingEvent names to Meta standard event
 * names. Both the sGTM publisher and the Meta CAPI publisher reference this
 * so neither adapter needs to know about the other.
 */
const META_EVENT_MAP: Record<string, string> = {
  BidPlaced: "BidPlaced",
  Purchase: "Purchase",
  InitiateCheckout: "InitiateCheckout",
  CompleteRegistration: "CompleteRegistration",
  Lead: "Lead",
  AddToWishlist: "AddToWishlist",
  RemoveFromWishlist: "RemoveFromWishlist",
};

export function metaEventNameFor(eventName: string): string {
  return META_EVENT_MAP[eventName] ?? eventName;
}
