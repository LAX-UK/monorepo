import {
  type ArtistAlertCriteria,
  type ArtistAlertCriteriaRefusal,
  artistAlertCriteriaRefusal,
} from "@auction/domain";
import type {
  ArtistWatchlistRow,
  IArtistExistenceReader,
  IArtistWatchlistRepository,
} from "@auction/persistence/interfaces";

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

  /**
   * Sets what the person wants to hear about for an artist they follow. The criteria must make
   * sense together (a domain rule); an artist they do not follow has no alert to set.
   */
  async setAlert(
    userId: string,
    artistId: string,
    criteria: ArtistAlertCriteria,
  ): Promise<
    | { kind: "saved"; row: ArtistWatchlistRow }
    | { kind: "refused"; reason: ArtistAlertCriteriaRefusal }
    | { kind: "not_following" }
  > {
    const reason = artistAlertCriteriaRefusal(criteria);
    if (reason) return { kind: "refused", reason };
    const row = await this.artistWatchlist.setAlert(userId, artistId, criteria);
    return row ? { kind: "saved", row } : { kind: "not_following" };
  }
}
