export interface IMediaAssetProcessorRepository {
  upsertProcessed(input: {
    key: string;
    width: number;
    height: number;
    blurDataURL: string;
  }): Promise<void>;
}
