export interface IQrCodeScanPurgeRepository {
  purgeBefore(cutoff: Date, batchSize: number): Promise<{ deleted: number; batchCount: number }>;
}
