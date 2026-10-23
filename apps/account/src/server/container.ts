import type { TokenEndpoint } from "@auction/identity-rp";
import { type AccountCookiePolicy, accountCookiePolicy } from "../lib/session-cookie";
import { completeAccountLogin } from "./application/complete-account-login";
import { startAccountLogin } from "./application/start-account-login";
import type { LaxAccountConfig } from "./config";
import { loadLaxAccountConfig } from "./config";
import { createAccountTokenEndpoint } from "./infrastructure/account-token-endpoint";
import { createExchangeResourceTokenProvider } from "./infrastructure/exchange-resource-token-provider";
import { createIssuerAccountIdentityGateway } from "./infrastructure/issuer-account-identity-gateway";
import { createIssuerSecurityFactsReader } from "./infrastructure/issuer-security-facts-reader";
import { createMemorySessionStore } from "./infrastructure/memory-session-store";
import { createProductPortfolioGateway } from "./infrastructure/product-portfolio-gateway";
import { createRedisSessionStore } from "./infrastructure/redis-session-store";
import type { AccountIdentityGateway } from "./ports/account-identity-gateway";
import type { PortfolioGateway } from "./ports/portfolio-gateway";
import type { SecurityFactsReader } from "./ports/security-facts-reader";
import type { SessionStore } from "./ports/session-store";

export type LaxAccountContainer = {
  config: LaxAccountConfig;
  cookies: AccountCookiePolicy;
  sessions: SessionStore;
  tokenEndpoint: TokenEndpoint;
  securityFacts: SecurityFactsReader;
  identity: AccountIdentityGateway;
  portfolio: PortfolioGateway;
  startAccountLogin: typeof startAccountLogin;
  completeAccountLogin: typeof completeAccountLogin;
};

const PORTFOLIO_TOKEN_EXCHANGE_TIMEOUT_MS = 3_000;

let cached: LaxAccountContainer | null = null;

function createSessionStore(config: LaxAccountConfig): SessionStore {
  if (config.NODE_ENV === "test") return createMemorySessionStore();
  return createRedisSessionStore({
    redisUrl: config.redisUrl,
    encryptionKey: config.sessionEncryptionKey,
  });
}

export function createLaxAccountContainer(config: LaxAccountConfig): LaxAccountContainer {
  const sessions = createSessionStore(config);
  return {
    config,
    cookies: accountCookiePolicy(config.publicOrigin),
    sessions,
    tokenEndpoint: createAccountTokenEndpoint(config),
    securityFacts: createIssuerSecurityFactsReader(config),
    identity: createIssuerAccountIdentityGateway(config),
    portfolio: createProductPortfolioGateway({
      apiUrls: {
        ...(config.bidApiUrl ? { bid: config.bidApiUrl } : {}),
        ...(config.shopApiUrl ? { shop: config.shopApiUrl } : {}),
      },
      tokens: createExchangeResourceTokenProvider({
        // A shorter limit than sign-in's: a slow issuer must not stall a page that reads products.
        tokenEndpoint: createAccountTokenEndpoint(config, PORTFOLIO_TOKEN_EXCHANGE_TIMEOUT_MS),
        sessions,
        sessionTtlSeconds: config.sessionTtlSeconds,
      }),
    }),
    startAccountLogin,
    completeAccountLogin,
  };
}

export function getLaxAccountContainer(): LaxAccountContainer {
  if (!cached) cached = createLaxAccountContainer(loadLaxAccountConfig());
  return cached;
}
