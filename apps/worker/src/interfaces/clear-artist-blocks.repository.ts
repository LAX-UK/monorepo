export interface IClearArtistBlocksRepository {
  getArtistStatus(artistId: string): Promise<string | null>;
  clearLotsArtistReviewRequired(artistId: string): Promise<void>;
}
