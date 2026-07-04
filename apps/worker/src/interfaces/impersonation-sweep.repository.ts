export interface IImpersonationSweepRepository {
  sweepStaleSessions(cutoff: Date, batchLimit: number): Promise<number>;
}
