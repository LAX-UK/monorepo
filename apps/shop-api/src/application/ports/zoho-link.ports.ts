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

/** A lax.art original that was linked from the report, with who linked it and when. */
export type LinkedListing = {
  artworkId: string;
  slug: string;
  title: string;
  artistName: string;
  published: boolean;
  registerId: string;
  stockCode: string;
  recordTitle: string;
  linkedAt: Date;
  /** The register history's actor: `staff:<id>`, or something else when not a person. */
  actor: string;
};

export interface ZohoLinkListingReader {
  /** What has been linked from the report and is still linked, newest first. */
  listLinked(): Promise<LinkedListing[]>;
  /** Every original on lax.art (draft or live, not archived) that has no Zoho Product id. */
  listUnlinked(): Promise<UnlinkedListing[]>;
  countUnlinked(): Promise<number>;
  findUnlinked(artworkId: string): Promise<UnlinkedListing | null>;
}

/** A register original, with the lax.art artwork already linked to it, if any. */
export type LinkableRecord = {
  entry: ArtworkRegisterEntry;
  /** The title of the lax.art artwork linked to this record; null when none is. */
  linkedTo: string | null;
};

export interface ZohoLinkRecordReader {
  /** Every register original. Those already linked say to which listing, so they are shown and cannot be chosen. */
  listLinkable(): Promise<LinkableRecord[]>;
  findById(registerId: string): Promise<LinkableRecord | null>;
  /** Originals whose stock code, title, artist name or artist code contains `query`. */
  search(query: string, limit: number): Promise<LinkableRecord[]>;
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
