import {
  ArtworkMoneyPausedError,
  type MoneyPauseReader,
  assertMoneyNotPaused,
} from "@auction/artwork-register-contracts";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { ShopApiError } from "../../errors/shop-api-error.js";

export type CheckoutMoneyPause = {
  pause: MoneyPauseReader;
  /** The Zoho Products behind these lax.art artworks; an artwork with none is not governed. */
  zohoProductIdsFor(artworkIds: readonly string[]): Promise<readonly string[]>;
};

/**
 * Refuses to start checkout for a basket holding an artwork Zoho says is Sold or Reserved while
 * it is still on lax.art, until staff decide. The buyer is told, calmly, it can no longer be
 * bought online; why is for staff, who have the item in their Needs attention list.
 */
export async function assertCheckoutNotPaused(
  guard: CheckoutMoneyPause,
  artworkIds: readonly string[],
): Promise<void> {
  if (artworkIds.length === 0) return;
  for (const zohoProductId of await guard.zohoProductIdsFor(artworkIds)) {
    try {
      await assertMoneyNotPaused(guard.pause, { zohoProductId }, "checkout");
    } catch (error) {
      if (error instanceof ArtworkMoneyPausedError) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, error.message, 409);
      }
      throw error;
    }
  }
}
