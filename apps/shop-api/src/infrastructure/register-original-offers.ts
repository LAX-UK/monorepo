import {
  type ArtworkOfferLock,
  ArtworkOfferMoveError,
  ArtworkOfferedElsewhereError,
  type OfferRef,
  type RegisterLink,
} from "@auction/artwork-register-contracts";
import { ShopDomainError } from "@auction/shop-domain";
import type {
  OfferedArtwork,
  OriginalOfferRegister,
} from "../application/ports/original-offer-register.js";

/** An original on lax.art, linked to its register entry by the Zoho Product id it already holds. */
function linkOf(artwork: OfferedArtwork): RegisterLink | null {
  const governed = artwork.salesChannel === "art" && artwork.runKind === null;
  return governed && artwork.zohoProductId ? { zohoProductId: artwork.zohoProductId } : null;
}

function refOf(artwork: OfferedArtwork): OfferRef {
  return { kind: "shop_artwork", id: artwork.id };
}

/** Staff see the register's own wording; a fault in the register is shown as a retryable conflict. */
async function translated<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ArtworkOfferedElsewhereError || error instanceof ArtworkOfferMoveError) {
      throw new ShopDomainError(error.message);
    }
    throw error;
  }
}

export function createRegisterOriginalOffers(lock: ArtworkOfferLock): OriginalOfferRegister {
  return {
    assertCanPublish: (artwork) =>
      translated(() => lock.assertCanOffer(linkOf(artwork), refOf(artwork))),
    recordPublished: (artwork, actor) =>
      translated(() => lock.offer(linkOf(artwork), refOf(artwork), actor)).then(() => undefined),
    recordWithdrawn: (artwork, actor) =>
      translated(() => lock.withdraw(linkOf(artwork), refOf(artwork), actor)).then(() => undefined),
    recordSold: (artwork, actor) =>
      translated(() => lock.markSold(linkOf(artwork), refOf(artwork), actor)).then(() => undefined),
  };
}
