export type ArtistWatchlistRow = {
  id: string;
  userId: string;
  artistId: string;
  createdAt: Date;
};

export interface IArtistWatchlistRepository {
  add(userId: string, artistId: string): Promise<ArtistWatchlistRow>;
  remove(userId: string, artistId: string): Promise<void>;
  findByUser(userId: string): Promise<ArtistWatchlistRow[]>;
  exists(userId: string, artistId: string): Promise<boolean>;
}
