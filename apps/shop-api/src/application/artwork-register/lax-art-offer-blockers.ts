import {
  type ArtworkRegisterEntry,
  type LockMessage,
  type OfferPlaceRef,
  checkOfferable,
  isReservedInZoho,
  lockMessage,
} from "@auction/artwork-register-contracts";

/** A probe place for the check: the draft does not exist yet, and the lock only compares places. */
export const DRAFT_PROBE: OfferPlaceRef = { kind: "shop_artwork", id: "new-lax-art-draft" };

/**
 * Why an original cannot go on lax.art now, most important first. A print never takes this path.
 * `checkOfferable` names the first reason; Zoho's Reserved is added beside a place that holds the
 * artwork, because staff need both to act (the lot comes down, and Zoho is set back to Available).
 */
export function laxArtOfferBlockers(
  entry: ArtworkRegisterEntry,
  ref: OfferPlaceRef,
): readonly LockMessage[] {
  if (entry.kind !== "original") return [lockMessage("print")];
  const blockers: LockMessage[] = [];
  const check = checkOfferable(entry, ref);
  if (!check.ok) blockers.push(check.error.lock);
  const reservedShown = blockers.some((blocker) => blocker.reason === "reserved_in_zoho");
  if (isReservedInZoho(entry.catalogueStatus) && !reservedShown) {
    blockers.push(lockMessage("reserved_in_zoho"));
  }
  return blockers;
}
