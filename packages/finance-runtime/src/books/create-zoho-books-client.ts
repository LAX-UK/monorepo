import {
  ZohoBooksClient,
  type ZohoBooksConfig,
  type ZohoLogger,
  type ZohoMetrics,
  type ZohoTokenStore,
  type ZohoTransport,
} from "@auction/accounting-zoho-books";
import type { Redis } from "ioredis";
import { redisZohoBooksLimits } from "./redis-zoho-books-limits.js";

export interface ZohoBooksHttpClientDeps {
  /** Shared by every replica: the daily budget, rate window and refresh lock live here. */
  readonly redis: Redis;
  readonly config: ZohoBooksConfig;
  readonly transport: ZohoTransport;
  readonly tokenStore: ZohoTokenStore;
  readonly logger?: ZohoLogger;
  readonly metrics?: ZohoMetrics;
}

/**
 * The one way a runtime builds the Zoho Books HTTP client: always with the limits shared through
 * Redis (`redisZohoBooksLimits`), so N replicas never get N times Zoho's rate limit or budget, or
 * refresh one token at once. Not wired anywhere yet; Books stays dry-run.
 */
export function createZohoBooksHttpClient(deps: ZohoBooksHttpClientDeps): ZohoBooksClient {
  const { redis, ...rest } = deps;
  return new ZohoBooksClient({ ...rest, ...redisZohoBooksLimits(redis, deps.config) });
}
