import {
  type ArtworkOfferLock,
  ArtworkOfferMoveError,
  ArtworkOfferedElsewhereError,
  type OfferPlaceRef,
  type RegisterLink,
} from "@auction/artwork-register-contracts";
import type { Database } from "@auction/db";
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

function refOf(artwork: OfferedArtwork): OfferPlaceRef {
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

/** `lockFor` binds the lock to the transaction the Shop change runs in. */
export function createRegisterOriginalOffers(
  lockFor: (session: Database) => ArtworkOfferLock,
): OriginalOfferRegister {
  return {
    assertCanPublish: (session, artwork) =>
      translated(() =>
        lockFor(session as Database).assertCanOffer(linkOf(artwork), refOf(artwork)),
      ),
    recordPublished: (session, artwork, actor) =>
      translated(() =>
        lockFor(session as Database).offer(linkOf(artwork), refOf(artwork), actor),
      ).then(() => undefined),
    recordWithdrawn: (session, artwork, actor) =>
      translated(() =>
        lockFor(session as Database).withdraw(linkOf(artwork), refOf(artwork), actor),
      ).then(() => undefined),
    recordSold: (session, artwork, actor) =>
      translated(() =>
        lockFor(session as Database).markSold(linkOf(artwork), refOf(artwork), actor),
      ).then(() => undefined),
  };
}
