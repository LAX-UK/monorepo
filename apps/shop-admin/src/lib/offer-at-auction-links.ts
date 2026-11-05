import type { AdminAuctionOfferAssessment } from "@auction/shop-contracts";

/** The addresses a LAX Admin screen can open. A missing one means the person cannot open it. */
export type OfferAtAuctionLinks = {
  /** Where Bid admin lives, only for a person who can open it. */
  bidAdminUrl: string | null;
  /** The Zoho Product's page, when a CRM address is set. */
  zohoUrl: string | null;
};

export const NO_OFFER_LINKS: OfferAtAuctionLinks = { bidAdminUrl: null, zohoUrl: null };

/** A lot's page in Bid admin; null when the person cannot open Bid admin. */
export function bidLotUrl(bidAdminUrl: string | null, lotId: string): string | null {
  return bidAdminUrl ? `${bidAdminUrl.replace(/\/+$/, "")}/lots/${lotId}` : null;
}

type Blocker = AdminAuctionOfferAssessment["blockers"][number];

export type BlockerLink = { label: string; href: string; external: boolean };

/**
 * Where the link in a refusal goes, when this person can follow it. A link the screen cannot open
 * is left out, so the reason still reads on its own.
 */
export function blockerLink(
  blocker: Blocker,
  assessment: Pick<AdminAuctionOfferAssessment, "artworkId" | "holdingLotId">,
  links: OfferAtAuctionLinks,
): BlockerLink | null {
  if (!blocker.link) return null;
  const { label, target } = blocker.link;
  switch (target) {
    case "bid_lot": {
      const href = assessment.holdingLotId
        ? bidLotUrl(links.bidAdminUrl, assessment.holdingLotId)
        : null;
      return href ? { label, href, external: true } : null;
    }
    case "zoho_record":
      return links.zohoUrl ? { label, href: links.zohoUrl, external: true } : null;
    case "lax_art_listing":
      return assessment.artworkId
        ? { label, href: `/artworks/${assessment.artworkId}`, external: false }
        : null;
    default:
      return null;
  }
}
