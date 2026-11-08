import {
  LAX_LISTING_LABEL,
  type LaxListingKey,
  type WithdrawnFrom,
  deriveBidSalePhase,
  deriveWhereItIs,
  laxListingKeyFor,
} from "@auction/artwork-register-contracts";
import type { ListingFacts } from "./listing-facts.js";
import type { ListingLinks } from "./listing-links.js";
import { LISTING_PRESENTERS } from "./listing-presenters.js";
import { ZOHO_LISTING_DETAIL_MAX, type ZohoListing } from "./zoho-listing-fields.js";

const WITHDRAWN_SOURCES: readonly string[] = ["lax_art", "bid_sale", "private_sale"];

function withdrawnFrom(state: string | null): WithdrawnFrom | null {
  return state && WITHDRAWN_SOURCES.includes(state) ? (state as WithdrawnFrom) : null;
}

function clip(text: string | null): string | null {
  if (!text) return null;
  return text.length <= ZOHO_LISTING_DETAIL_MAX
    ? text
    : `${text.slice(0, ZOHO_LISTING_DETAIL_MAX - 1)}…`;
}

/**
 * The listing for one original, from the same "Where it is" derivation LAX Admin draws, plus the
 * Bid sale phase. Pure: the same facts and time always give the same listing.
 */
export function computeZohoListing(
  facts: ListingFacts,
  now: Date,
  links: ListingLinks,
): ZohoListing & { key: LaxListingKey } {
  const { entry, lastMove, lot, laxArt } = facts;
  const withdrawn =
    entry.offer.state === "withdrawn" && lastMove?.to === "withdrawn"
      ? { at: lastMove.at, from: withdrawnFrom(lastMove.from) }
      : null;
  const where = deriveWhereItIs({
    offer: entry.offer,
    now,
    withdrawn,
    hasLaxArtDraft: laxArt !== null && !laxArt.published && !laxArt.archived,
    hasBidDraftLot: lot !== null && lot.status === "draft" && !lot.deleted,
  });
  const phase =
    where.key === "bid_sale" && lot
      ? deriveBidSalePhase({
          lotStatus: lot.status,
          saleStatus: lot.sale?.status ?? null,
          saleStartTime: lot.sale?.startTime ?? null,
          now,
        })
      : null;
  const key = laxListingKeyFor(where, phase);
  const { detail, link } = LISTING_PRESENTERS[key]({ facts, where, links });
  return { key, value: LAX_LISTING_LABEL[key], detail: clip(detail), link };
}
