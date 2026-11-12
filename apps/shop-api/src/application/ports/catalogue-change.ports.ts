import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import type { ArtistForCode, LinkListingFacts } from "../artwork-register/zoho-link-differences.js";

/** A lax.art listing made from a register record, as far as "Zoho changed" needs it. */
export type LaxArtCatalogueCopy = {
  artworkId: string;
  /** Live on lax.art. A published listing is never changed from Zoho. */
  published: boolean;
  facts: LinkListingFacts;
  /** The lax.art artist that carries the record's Zoho artist code, if any. */
  artistForCode: ArtistForCode;
};

/** The listing is published (or gone) now, so it is left as it is. */
export class CatalogueCopyRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogueCopyRefusedError";
  }
}

export interface LaxArtCatalogueCopyStore {
  /** The listing made from this Zoho Product, draft or live; null when there is none. */
  read(zohoProductId: string): Promise<LaxArtCatalogueCopy | null>;
  /**
   * Gives a draft listing Zoho's values, in one transaction that re-checks the listing is still
   * a draft, and records who did it. Returns the labels of the fields that changed.
   * Throws `CatalogueCopyRefusedError` when the listing is published, gone, or its artist cannot follow.
   */
  updateDraft(command: {
    zohoProductId: string;
    entry: ArtworkRegisterEntry;
    actorSubjectId: string;
  }): Promise<{ updated: string[] }>;
}
