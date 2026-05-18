export interface ICircuitBreaker {
  run<T>(key: string, fn: () => Promise<T>): Promise<T>;
  isOpen(key: string): boolean;
}
