import {
  ART_LISTING_LOOKUP_MAX_IDS,
  ART_LISTING_LOOKUP_SUBROUTE,
  type ArtListingFacts,
  type InventoryPeerClient,
  InventoryPeerUnavailableError,
  artListingLookupAnswerSchema,
} from "@auction/artwork-register-contracts";
import { CrmGatewayError } from "../../../crm/crm-gateway-error.js";

/** lax.art listings by the Zoho Product id each carries. LAX Shop owns them, so this asks it. */
export interface LaxArtListings {
  find(zohoProductIds: readonly string[]): Promise<ArtListingFacts[]>;
}

/**
 * Asks LAX Shop over the inventory machine route. LAX Shop being briefly unreachable retries; a
 * refusal (the credential is wrong or not set) is a setup fault and goes to Failed deliveries.
 */
export class ShopApiLaxArtListings implements LaxArtListings {
  constructor(private readonly peer: InventoryPeerClient) {}

  async find(zohoProductIds: readonly string[]): Promise<ArtListingFacts[]> {
    const ids = [...new Set(zohoProductIds)];
    const listings: ArtListingFacts[] = [];
    for (let at = 0; at < ids.length; at += ART_LISTING_LOOKUP_MAX_IDS) {
      const answer = await this.ask(ids.slice(at, at + ART_LISTING_LOOKUP_MAX_IDS));
      listings.push(...answer);
    }
    return listings;
  }

  private async ask(zohoProductIds: string[]): Promise<ArtListingFacts[]> {
    try {
      const answer = await this.peer.call(
        "POST",
        ART_LISTING_LOOKUP_SUBROUTE,
        artListingLookupAnswerSchema,
        { zohoProductIds },
      );
      return answer.listings;
    } catch (error) {
      const unavailable = error instanceof InventoryPeerUnavailableError;
      throw new CrmGatewayError({
        code: unavailable ? "lax_art_unavailable" : "lax_art_refused",
        message: error instanceof Error ? error.message : "lax_art_lookup_failed",
        status: unavailable ? 503 : 400,
        retryable: unavailable,
      });
    }
  }
}
