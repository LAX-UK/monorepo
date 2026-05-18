import type { ICircuitBreaker } from "./interfaces/circuit-breaker.js";

type BreakerState = {
  failures: number[];
  openUntil: number;
};

const WINDOW_MS = 60_000;
const FAILURE_THRESHOLD = 5;
const OPEN_MS = 30_000;

export class InMemoryCircuitBreaker implements ICircuitBreaker {
  private readonly states = new Map<string, BreakerState>();

  private getState(key: string): BreakerState {
    let s = this.states.get(key);
    if (!s) {
      s = { failures: [], openUntil: 0 };
      this.states.set(key, s);
    }
    return s;
  }

  isOpen(key: string): boolean {
    const s = this.getState(key);
    if (Date.now() < s.openUntil) return true;
    return false;
  }

  recordFailure(key: string): void {
    const s = this.getState(key);
    const now = Date.now();
    s.failures = s.failures.filter((t) => now - t < WINDOW_MS);
    s.failures.push(now);
    if (s.failures.length >= FAILURE_THRESHOLD) {
      s.openUntil = now + OPEN_MS;
    }
  }

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (this.isOpen(key)) {
      throw new Error(`circuit_open:${key}`);
    }
    try {
      const result = await fn();
      this.getState(key).failures = [];
      return result;
    } catch (err) {
      this.recordFailure(key);
      throw err;
    }
  }
}
