import type { ArtworkRegisterEntry, CatalogueGap } from "@auction/artwork-register-contracts";
import type { RegisterConflict } from "./artwork-register.js";

/** Narrows a queue by artist (the artist part of the stock code) and by one missing part. */
export type RegisterQueueFilter = {
  artistCode?: string;
  missing?: CatalogueGap;
};

export type RegisterQueuePage = { limit: number; offset: number };

export type QueuedConflict = { conflict: RegisterConflict; entry: ArtworkRegisterEntry };

export type ArtworkRegisterArtistCount = { code: string; name: string; count: number };

/**
 * The queues staff work through in LAX Admin: artworks that came in from Zoho and are not offered
 * anywhere yet, and conflicts waiting for a decision. Reads only.
 */
export interface IArtworkRegisterQueue {
  /** Held records, newest Zoho edit first. `total` counts every match, not just this page. */
  listHeld(
    filter: RegisterQueueFilter,
    page: RegisterQueuePage,
  ): Promise<{ entries: ArtworkRegisterEntry[]; total: number }>;
  /** Open conflicts with their artwork, oldest first. */
  listOpenConflicts(
    filter: RegisterQueueFilter,
    page: RegisterQueuePage,
  ): Promise<{ items: QueuedConflict[]; total: number }>;
  /** Every conflict on one artwork, open first, then resolved, newest first. */
  listConflictsFor(registerId: string): Promise<RegisterConflict[]>;
  countHeld(): Promise<number>;
  countOpenConflicts(): Promise<number>;
  /** The artists with held records, for the artist filter, by name. */
  listHeldArtists(): Promise<ArtworkRegisterArtistCount[]>;
}
