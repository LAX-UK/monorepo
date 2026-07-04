export interface IVerificationPurgeRepository {
  purgeBefore(cutoff: Date): Promise<{ deleted: number }>;
}
