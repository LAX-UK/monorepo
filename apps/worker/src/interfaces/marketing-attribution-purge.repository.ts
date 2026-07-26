export interface IMarketingAttributionPurgeRepository {
  purgeStale(staleBefore: Date): Promise<number>;
}
