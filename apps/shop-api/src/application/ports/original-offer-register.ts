import type { ShopPhaseDbSession } from "./shop-unit-of-work.js";

/** What the register needs to know about an artwork row to decide whether it is governed. */
export type OfferedArtwork = {
  id: string;
  zohoProductId: string | null;
  salesChannel: "shop" | "art";
  /** Set for an edition's print run; null for an original. */
  runKind: string | null;
};

/**
 * One place at a time for originals on lax.art. Every call is a no-op for an artwork with no
 * register entry, so nothing changes until the register is filled.
 *
 * Every call takes the Shop transaction it runs in: the register lives in the same database, so the
 * move commits or rolls back together with the Shop change.
 *
 * `assertCanPublish` throws `ShopDomainError` (409) with a message staff can act on when the
 * artwork is offered elsewhere or already sold.
 */
export interface OriginalOfferRegister {
  assertCanPublish(session: ShopPhaseDbSession, artwork: OfferedArtwork): Promise<void>;
  /** Checks again and records the original as offered on lax.art. */
  recordPublished(
    session: ShopPhaseDbSession,
    artwork: OfferedArtwork,
    actor: string,
  ): Promise<void>;
  /** The original left lax.art without selling (unpublished or archived). */
  recordWithdrawn(
    session: ShopPhaseDbSession,
    artwork: OfferedArtwork,
    actor: string,
  ): Promise<void>;
  /** The original sold on lax.art. */
  recordSold(session: ShopPhaseDbSession, artwork: OfferedArtwork, actor: string): Promise<void>;
}

export const noOriginalOfferRegister: OriginalOfferRegister = {
  assertCanPublish: async () => {},
  recordPublished: async () => {},
  recordWithdrawn: async () => {},
  recordSold: async () => {},
};
