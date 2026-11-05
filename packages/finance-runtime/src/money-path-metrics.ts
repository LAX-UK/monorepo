/**
 * Where money-path counters go (payment created, invoice deferred, hold applied). The API passes
 * its Prometheus recorder; a process without metrics passes nothing and the counts are dropped.
 */
export interface IMoneyPathMetrics {
  record(event: string): void;
}

export const noMoneyPathMetrics: IMoneyPathMetrics = { record: () => {} };
