export interface IMarketingClickIdPurgeRepository {
  purgeStale(staleBefore: Date): Promise<number>;
}
