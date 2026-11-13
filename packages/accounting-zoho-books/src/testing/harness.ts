import { ZohoBooksClient } from "../client.js";
import type { ZohoBooksConfig } from "../config.js";
import { Secret } from "../secret.js";
import { FakeClock } from "./fake-clock.js";
import { FakeZohoTransport, tokenReply } from "./fake-transport.js";
import {
  type FixedBudget,
  InMemoryTokenStore,
  RecordingLogger,
  RecordingMetrics,
} from "./fakes.js";

export const TEST_ORG = "20091234567";
export const TEST_REFRESH_TOKEN =
  "1000.refreshrefreshrefreshrefreshrefresh.refreshrefreshrefreshrefreshrefresh";
export const TEST_CLIENT_SECRET = "client-secret-for-tests-only";
export const TEST_DEK_KEY = "ab".repeat(32);

export function testConfig(overrides: Partial<ZohoBooksConfig> = {}): ZohoBooksConfig {
  return {
    apiBaseUrl: "https://books.zoho.eu/api/v3",
    accountsBaseUrl: "https://accounts.zoho.eu",
    clientId: "1000.CLIENTIDFORTESTS",
    clientSecret: new Secret(TEST_CLIENT_SECRET),
    tokenDekKey: new Secret(TEST_DEK_KEY),
    requestTimeoutMs: 10_000,
    maxAttempts: 3,
    retryBaseDelayMs: 500,
    retryMaxDelayMs: 8_000,
    maxRetryAfterMs: 30_000,
    ratePerMinute: 100,
    maxConcurrent: 5,
    maxQueueWaitMs: 30_000,
    dailyCallBudget: 1_000,
    maxResponseBytes: 1_000_000,
    ...overrides,
  };
}

export interface ClientHarness {
  readonly client: ZohoBooksClient;
  readonly transport: FakeZohoTransport;
  readonly clock: FakeClock;
  readonly store: InMemoryTokenStore;
  readonly logger: RecordingLogger;
  readonly metrics: RecordingMetrics;
  readonly config: ZohoBooksConfig;
  /** Authorise the organisation and script its first token refresh (pass `null` to script it yourself). */
  connect(organizationId?: string, accessToken?: string | null): Promise<void>;
}

/**
 * Everything a test of code built on the client needs, with no network: a fake transport and
 * clock, an in-memory token store, recording logger and metrics. `random` is fixed at 0.5 so
 * backoff delays are exact.
 */
export function createClientHarness(
  options: { config?: Partial<ZohoBooksConfig>; budget?: FixedBudget } = {},
): ClientHarness {
  const config = testConfig(options.config);
  const transport = new FakeZohoTransport();
  const clock = new FakeClock();
  const store = new InMemoryTokenStore();
  const logger = new RecordingLogger();
  const metrics = new RecordingMetrics();
  const client = new ZohoBooksClient({
    config,
    transport,
    tokenStore: store,
    clock,
    logger,
    metrics,
    random: () => 0.5,
    ...(options.budget ? { budget: options.budget } : {}),
  });
  return {
    client,
    transport,
    clock,
    store,
    logger,
    metrics,
    config,
    async connect(organizationId = TEST_ORG, accessToken = "access-token-1") {
      await client.registerRefreshToken(organizationId, TEST_REFRESH_TOKEN);
      if (accessToken !== null) {
        transport.enqueue(tokenReply(accessToken), (r) => r.url.includes("/oauth/v2/token"));
      }
    },
  };
}
