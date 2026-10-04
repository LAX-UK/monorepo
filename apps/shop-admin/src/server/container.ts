import { completeStaffLogin } from "./application/complete-staff-login";
import { endStaffSession } from "./application/end-staff-session";
import { forwardAdminRequest } from "./application/forward-admin-request";
import { startStaffLogin } from "./application/start-staff-login";
import type { ShopAdminConfig } from "./config";
import { loadShopAdminConfig } from "./config";
import { createFetchAdminApiClient } from "./infrastructure/fetch-admin-api-client";
import { createMemorySessionStore } from "./infrastructure/memory-session-store";
import { createRedisSessionStore } from "./infrastructure/redis-session-store";
import { systemClock } from "./infrastructure/system-clock";
import type { AdminApiClient } from "./ports/admin-api-client";
import type { Clock } from "./ports/clock";
import type { SessionStore } from "./ports/session-store";

export type ShopAdminContainer = {
  config: ShopAdminConfig;
  sessions: SessionStore;
  adminApi: AdminApiClient;
  clock: Clock;
  startStaffLogin: typeof startStaffLogin;
  completeStaffLogin: typeof completeStaffLogin;
  forwardAdminRequest: typeof forwardAdminRequest;
  endStaffSession: typeof endStaffSession;
};

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
  return {
    config,
    sessions,
    adminApi,
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
