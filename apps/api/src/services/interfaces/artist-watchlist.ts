export type { ArtistWatchlistRow, IArtistWatchlistRepository } from "@auction/persistence";

/** ISP: existence check only (watchlist must not depend on full user repository surface). */
export interface IArtistExistenceReader {
  findById(id: string): Promise<{ id: string } | null>;
}
