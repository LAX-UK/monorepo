export type ArtistWatchlistRow = {
  id: string;
  userId: string;
  artistId: string;
  createdAt: Date;
};

/** ISP: existence check only (watchlist must not depend on full user repository surface). */
export interface IArtistExistenceReader {
  findById(id: string): Promise<{ id: string } | null>;
}

export interface IArtistWatchlistRepository {
  add(userId: string, artistId: string): Promise<ArtistWatchlistRow>;
  remove(userId: string, artistId: string): Promise<void>;
  findByUser(userId: string): Promise<ArtistWatchlistRow[]>;
  exists(userId: string, artistId: string): Promise<boolean>;
}
