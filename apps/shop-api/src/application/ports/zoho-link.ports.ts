import type { ArtworkRegisterEntry, LockMessage } from "@auction/artwork-register-contracts";
import type { LinkListingFacts } from "../artwork-register/zoho-link-differences.js";
import type { MatchListing } from "../artwork-register/zoho-link-matcher.js";

/**
 * What "Link lax.art" needs from Shop and the register. Reading is separate from writing so the
 * report can only ever read.
 */

/** A lax.art original that is not linked to a register record. */
export type UnlinkedListing = MatchListing &
  LinkListingFacts & {
    slug: string;
    published: boolean;
  };

export interface ZohoLinkListingReader {
  /** Every original on lax.art (draft or live, not archived) that has no Zoho Product id. */
  listUnlinked(): Promise<UnlinkedListing[]>;
  countUnlinked(): Promise<number>;
  findUnlinked(artworkId: string): Promise<UnlinkedListing | null>;
}

export interface ZohoLinkRecordReader {
  /** Register originals that no lax.art artwork is linked to yet. */
  listLinkable(): Promise<ArtworkRegisterEntry[]>;
  findById(registerId: string): Promise<ArtworkRegisterEntry | null>;
  /** Linkable originals whose stock code, title or artist name contains `query`. */
  search(query: string, limit: number): Promise<ArtworkRegisterEntry[]>;
}

export type LinkCommand = { artworkId: string; registerId: string; actorSubjectId: string };

export type LinkWritten = {
  /** False when the artwork was already linked to this record. */
  linked: boolean;
  nowOnLaxArt: boolean;
  replaced: readonly string[];
};

/** The register or the artist says no. `blockers` are the lock's own messages when it is the lock. */
export class ZohoLinkRefusedError extends Error {
  constructor(
    message: string,
    readonly blockers: readonly LockMessage[] = [],
  ) {
    super(message);
    this.name = "ZohoLinkRefusedError";
  }
}

export type UnlinkCommand = { artworkId: string; reason: string; actorSubjectId: string };

export interface ZohoLinkWriter {
  /**
   * Links the artwork to the record in one transaction, with the offer lock: Zoho's values replace
   * lax.art's, a live listing of a record that is not offered becomes On lax.art, and the history
   * records who linked it. Repeating it returns the same result with `linked: false`.
   * Throws `ZohoLinkRefusedError`.
   */
  link(command: LinkCommand): Promise<LinkWritten>;
  /**
   * Removes the link. Refused while the artwork is in a Bid sale. A live listing's place in the
   * register is released. Returns false when the artwork was not linked (nothing changed).
   * Throws `ZohoLinkRefusedError`.
   */
  unlink(command: UnlinkCommand): Promise<boolean>;
}

/** The switch that stops publishing an original that is not linked to Zoho. */
export interface ZohoLinkSettingsStore {
  blockUnlinkedPublish(): Promise<boolean>;
  setBlockUnlinkedPublish(enabled: boolean, actorSubjectId: string): Promise<void>;
}
