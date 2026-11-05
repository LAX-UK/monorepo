/** Where an offer at auction starts: an original's lax.art page, or its From Zoho record. */
export type AuctionOfferTarget =
  | { kind: "artwork"; artworkId: string }
  | { kind: "register"; registerId: string };
