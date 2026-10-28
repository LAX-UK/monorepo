import type { ProofType } from "./edition-run.js";
import { ShopDomainError } from "./shop-domain-error.js";

/**
 * Proof and companion listings: separate artworks linked to a main run. A proof listing sells
 * some of the proofs the main run kept; a companion is another run of the same image with its own
 * facts, such as an unsigned open edition beside a signed limited one. Everything here is pure.
 */

export type ProofOwner = "artist" | "lax";

const DEFAULT_PROOF_OWNER: Record<ProofType, ProofOwner> = {
  ap: "artist",
  pp: "lax",
  hc: "lax",
};

/** Who owns the proofs unless staff choose otherwise: the artist for AP, LAX for PP and HC. */
export function defaultProofOwner(type: ProofType): ProofOwner {
  return DEFAULT_PROOF_OWNER[type];
}

const TITLE_SUFFIX: Record<ProofType, string> = {
  ap: "artist's proof",
  pp: "printer's proof",
  hc: "hors commerce proof",
};

/** "Harbour at dusk (artist's proof)". */
export function proofListingTitle(mainTitle: string, type: ProofType): string {
  return `${mainTitle.trim()} (${TITLE_SUFFIX[type]})`;
}

const SLUG_SUFFIX: Record<ProofType, string> = {
  ap: "artists-proof",
  pp: "printers-proof",
  hc: "hors-commerce-proof",
};

/** "harbour-at-dusk-artists-proof". */
export function proofListingSlug(mainSlug: string, type: ProofType): string {
  return `${mainSlug}-${SLUG_SUFFIX[type]}`;
}

/**
 * Hors commerce proofs were not made to be sold. Listing one needs a shop admin's approval, given
 * when the listing is created, and its page always says "originally not for sale".
 */
export function assertProofListingApproved(input: {
  proofType: ProofType;
  approvedByShopAdmin: boolean;
}): void {
  if (input.proofType === "hc" && !input.approvedByShopAdmin) {
    throw new ShopDomainError(
      "A hors commerce proof can be listed only with a shop admin's approval",
    );
  }
}

export const CORRECTION_REASON_MAX_LENGTH = 500;

/** Correcting the facts after a sale is recorded with why, so the change can be explained. */
export function assertCorrectionReason(reason: string | null | undefined): string {
  const trimmed = reason?.trim() ?? "";
  if (!trimmed) throw new ShopDomainError("Say why the edition facts are being corrected");
  if (trimmed.length > CORRECTION_REASON_MAX_LENGTH) {
    throw new ShopDomainError(
      `Keep the reason to ${CORRECTION_REASON_MAX_LENGTH} characters or fewer`,
    );
  }
  return trimmed;
}
