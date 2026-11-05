import type { ArtworkRegisterEntry, LockMessage } from "@auction/artwork-register-contracts";
import type { AdminLaxArtListing } from "@auction/shop-contracts";

/**
 * What "Offer on lax.art" needs from Shop. The register belongs to neither product; the artist
 * directory, the listings and the draft writer are Shop's own tables behind these ports.
 */

export type MatchedArtist = { artistId: string; displayName: string };

export interface LaxArtArtistDirectory {
  /** The lax.art artist that carries this Zoho artist code, archived or not. */
  findByZohoArtistCode(code: string): Promise<(MatchedArtist & { archived: boolean }) | null>;
}

export interface LaxArtListingReader {
  /** The lax.art listing made from this register record, draft or live. */
  findByZohoProductId(zohoProductId: string): Promise<AdminLaxArtListing | null>;
  /** The Zoho Product id a lax.art artwork was made from; null for an unlinked artwork. */
  findZohoProductId(artworkId: string): Promise<string | null>;
}

export type CreateLaxArtDraftCommand = {
  entry: ArtworkRegisterEntry;
  artistId: string;
  saleState: "for_sale" | "price_on_application";
  slug: string;
  actorSubjectId: string;
  idempotencyKey: string;
};

export type CreatedLaxArtDraft = {
  artworkId: string;
  slug: string;
  /** False when the record already had its draft and this is the one made earlier. */
  created: boolean;
};

/** The register says the artwork cannot be offered now (someone moved it while the dialog was open). */
export class LaxArtOfferRefusedError extends Error {
  constructor(readonly blockers: readonly LockMessage[]) {
    super(blockers.map((blocker) => blocker.message).join(" "));
    this.name = "LaxArtOfferRefusedError";
  }
}

/** The chosen artist cannot take this artwork: gone, or already tied to another Zoho artist. */
export class LaxArtArtistRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LaxArtArtistRefusedError";
  }
}

export interface LaxArtDraftWriter {
  /**
   * Creates the draft from the register entry in one transaction: re-checks the register, saves
   * Zoho's code on the artist when it has none, copies Zoho's fields and images, and records the
   * history. Safe to repeat: a record that already has its draft returns that draft.
   *
   * Throws `LaxArtOfferRefusedError`, `LaxArtArtistRefusedError`, or `ShopApiError` 409 for a
   * taken web address.
   */
  createDraft(command: CreateLaxArtDraftCommand): Promise<CreatedLaxArtDraft>;
}
