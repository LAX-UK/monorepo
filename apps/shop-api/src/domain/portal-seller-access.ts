export type PortalSellerAccessFacts = {
  /** Per owned artwork: the last time staff granted sale authority, and editions now authorised. */
  saleAuthority: readonly { lastGrantAt: string | null; authorisedCount: number }[];
  hasSaleAuthorityRequest: boolean;
  hasPayout: boolean;
  hasSalesStatement: boolean;
  hasLinkedArtist: boolean;
  /** Has an application to join the gallery as an artist, in any status. */
  hasArtistApplication: boolean;
  payoutsEnabled: boolean;
};

export type PortalSellerAccessDecision = {
  editions: boolean;
  payouts: boolean;
  artist: boolean;
  application: boolean;
};

/**
 * Decides which seller tools to offer a person from their own records. Sale authority rows exist
 * for every edition a person owns, collectors included, so a row alone proves nothing: staff must
 * have granted authority or the person must have asked for it.
 */
export function decidePortalSellerAccess(
  facts: PortalSellerAccessFacts,
): PortalSellerAccessDecision {
  const editions =
    facts.hasSaleAuthorityRequest ||
    facts.saleAuthority.some((row) => row.lastGrantAt !== null || row.authorisedCount > 0);
  const payouts = facts.payoutsEnabled && (editions || facts.hasPayout || facts.hasSalesStatement);
  return {
    editions,
    payouts,
    artist: facts.hasLinkedArtist,
    application: facts.hasArtistApplication,
  };
}
