export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec?: number;
};

export interface IRateLimitStore {
  increment(key: string, limit: number, windowSec: number): Promise<RateLimitResult>;
}
