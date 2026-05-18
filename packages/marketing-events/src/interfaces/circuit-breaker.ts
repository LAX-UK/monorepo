export interface ICircuitBreaker {
  isOpen(key: string): boolean;
  run<T>(key: string, fn: () => Promise<T>): Promise<T>;
  /** Record a failure without executing fn (e.g. HTTP 5xx returned as PublishOutcome). */
  recordFailure(key: string): void;
}
