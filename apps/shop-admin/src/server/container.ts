import { createFetchTokenEndpoint } from "@auction/identity-rp";
import { completeStaffLogin } from "./application/complete-staff-login";
import { endStaffSession } from "./application/end-staff-session";
import { forwardAdminRequest } from "./application/forward-admin-request";
import { startStaffLogin } from "./application/start-staff-login";
import type { ShopAdminConfig } from "./config";
import { loadShopAdminConfig } from "./config";
import { createCachedStaffToolsAccess } from "./infrastructure/cached-staff-tools-access";
import { createFetchAdminApiClient } from "./infrastructure/fetch-admin-api-client";
import { createHttpStaffToolsAccess } from "./infrastructure/http-staff-tools-access";
import { createMemorySessionStore } from "./infrastructure/memory-session-store";
import { createRedisSessionStore } from "./infrastructure/redis-session-store";
import { systemClock } from "./infrastructure/system-clock";
import type { AdminApiClient } from "./ports/admin-api-client";
import type { Clock } from "./ports/clock";
import type { SessionStore } from "./ports/session-store";
import type { StaffToolsAccess } from "./ports/staff-tools-access";

export type ShopAdminContainer = {
  config: ShopAdminConfig;
  sessions: SessionStore;
  adminApi: AdminApiClient;
  staffTools: StaffToolsAccess;
  clock: Clock;
  startStaffLogin: typeof startStaffLogin;
  completeStaffLogin: typeof completeStaffLogin;
  forwardAdminRequest: typeof forwardAdminRequest;
  endStaffSession: typeof endStaffSession;
};

/** A revoked role stops being offered in the switcher within a minute. */
const STAFF_TOOLS_TTL_MS = 60_000;
/** An unreachable Bid API is retried after a few seconds, not on every page. */
const STAFF_TOOLS_FAILURE_TTL_MS = 15_000;
const STAFF_TOOLS_TIMEOUT_MS = 1_500;

let cached: ShopAdminContainer | null = null;

function createSessionStore(config: ShopAdminConfig): SessionStore {
  if (config.NODE_ENV === "test") {
    return createMemorySessionStore();
  }
  return createRedisSessionStore({
    redisUrl: config.redisUrl,
    encryptionKey: config.sessionEncryptionKey,
  });
}

export function createShopAdminContainer(config: ShopAdminConfig): ShopAdminContainer {
  const sessions = createSessionStore(config);
  const adminApi = createFetchAdminApiClient();
  const clock = systemClock;
  const staffTools = createCachedStaffToolsAccess(
    createHttpStaffToolsAccess({
      baseUrl: config.bidApiInternalUrl,
      tokenEndpoint: createFetchTokenEndpoint({
        tokenEndpointUrl: `${config.oidcInternalIssuer}/api/auth/oauth2/token`,
        auth: {
          kind: "basic",
          clientId: config.oidcClientId,
          clientSecret: config.oidcClientSecret,
        },
        timeoutMs: STAFF_TOOLS_TIMEOUT_MS,
      }),
      timeoutMs: STAFF_TOOLS_TIMEOUT_MS,
    }),
    { clock, ttlMs: STAFF_TOOLS_TTL_MS, failureTtlMs: STAFF_TOOLS_FAILURE_TTL_MS },
  );
  return {
    config,
    sessions,
    adminApi,
    staffTools,
    clock,
    startStaffLogin,
    completeStaffLogin,
    forwardAdminRequest,
    endStaffSession,
  };
}

export function getShopAdminContainer(): ShopAdminContainer {
  if (!cached) {
    cached = createShopAdminContainer(loadShopAdminConfig());
  }
  return cached;
}
