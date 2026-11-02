export interface IMediaAssetProcessorRepository {
  upsertProcessed(input: {
    key: string;
    width: number;
    height: number;
    blurDataURL: string;
  }): Promise<void>;

  /**
   * Primary lot pictures held as full https addresses (seeded or imported, not uploaded) that
   * have no stored size yet, skipping the addresses in `exclude`.
   */
  listUnmeasuredExternalLotPictures(limit: number, exclude: readonly string[]): Promise<string[]>;
}
