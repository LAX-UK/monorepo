/** ISP: existence check only (watchlist must not depend on full artist repository surface). */
export interface IArtistExistenceReader {
  findById(id: string): Promise<{ id: string } | null>;
}
