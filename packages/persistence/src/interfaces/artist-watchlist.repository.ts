import type { ArtistAlertCriteria } from "@auction/domain";

export type ArtistWatchlistRow = {
  id: string;
  userId: string;
  artistId: string;
  createdAt: Date;
  /** What the person wants to hear about for this artist; all empty means every new lot. */
  alert: ArtistAlertCriteria;
};

export interface IArtistWatchlistRepository {
  add(userId: string, artistId: string): Promise<ArtistWatchlistRow>;
  remove(userId: string, artistId: string): Promise<void>;
  findByUser(userId: string): Promise<ArtistWatchlistRow[]>;
  exists(userId: string, artistId: string): Promise<boolean>;
  /** Replaces the alert criteria; `null` when the person does not follow the artist. */
  setAlert(
    userId: string,
    artistId: string,
    criteria: ArtistAlertCriteria,
  ): Promise<ArtistWatchlistRow | null>;
}
