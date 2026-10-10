import type { TokenEndpoint } from "@auction/identity-rp";
import { type AccountCookiePolicy, accountCookiePolicy } from "../lib/session-cookie";
import { completeAccountLogin } from "./application/complete-account-login";
import { startAccountLogin } from "./application/start-account-login";
import type { LaxAccountConfig } from "./config";
import { loadLaxAccountConfig } from "./config";
import { createAccountTokenEndpoint } from "./infrastructure/account-token-endpoint";
import { createMemorySessionStore } from "./infrastructure/memory-session-store";
import { createRedisSessionStore } from "./infrastructure/redis-session-store";
import type { SessionStore } from "./ports/session-store";

export type LaxAccountContainer = {
  config: LaxAccountConfig;
  cookies: AccountCookiePolicy;
  sessions: SessionStore;
  tokenEndpoint: TokenEndpoint;
  startAccountLogin: typeof startAccountLogin;
  completeAccountLogin: typeof completeAccountLogin;
};

let cached: LaxAccountContainer | null = null;

function createSessionStore(config: LaxAccountConfig): SessionStore {
  if (config.NODE_ENV === "test") return createMemorySessionStore();
  return createRedisSessionStore({
    redisUrl: config.redisUrl,
    encryptionKey: config.sessionEncryptionKey,
  });
}

export function createLaxAccountContainer(config: LaxAccountConfig): LaxAccountContainer {
  return {
    config,
    cookies: accountCookiePolicy(config.publicOrigin),
    sessions: createSessionStore(config),
    tokenEndpoint: createAccountTokenEndpoint(config),
    startAccountLogin,
    completeAccountLogin,
  };
}

export function getLaxAccountContainer(): LaxAccountContainer {
  if (!cached) cached = createLaxAccountContainer(loadLaxAccountConfig());
  return cached;
}
