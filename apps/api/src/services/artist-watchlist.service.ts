import type { ArtistWatchlistRow, IArtistExistenceReader, IArtistWatchlistRepository } from "./interfaces/artist-watchlist.js";

export class ArtistWatchlistService {
  constructor(
    private readonly artistWatchlist: IArtistWatchlistRepository,
    private readonly artists: IArtistExistenceReader,
  ) {}

  async add(userId: string, artistId: string): Promise<ArtistWatchlistRow | null> {
    if (userId === artistId) return null;
    const artist = await this.artists.findById(artistId);
    if (!artist) return null;
    return this.artistWatchlist.add(userId, artistId);
  }

  remove(userId: string, artistId: string): Promise<void> {
    return this.artistWatchlist.remove(userId, artistId);
  }

  list(userId: string): Promise<ArtistWatchlistRow[]> {
    return this.artistWatchlist.findByUser(userId);
  }

  exists(userId: string, artistId: string): Promise<boolean> {
    return this.artistWatchlist.exists(userId, artistId);
  }
}
