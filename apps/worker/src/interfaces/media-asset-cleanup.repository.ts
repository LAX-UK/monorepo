export interface IMediaAssetCleanupRepository {
  isKeyReferenced(values: readonly string[]): Promise<boolean>;
  getVariants(key: string): Promise<Record<string, string> | null>;
  deleteByKey(key: string): Promise<void>;
}
