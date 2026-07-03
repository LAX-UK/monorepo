export type MediaAssetRecord = {
  key: string;
  width: number;
  height: number;
  blurDataURL: string;
};

export interface IMediaAssetReader {
  lookupByKeys(keys: readonly string[]): Promise<Map<string, MediaAssetRecord>>;
}
