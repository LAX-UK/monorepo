import type { Database } from "@auction/db";
import type { Redis } from "ioredis";
import { createTokenExchangePorts } from "../infrastructure/token-exchange-adapters.js";
import type { JwksProvider } from "../infrastructure/token-exchange-adapters.js";
import { TokenExchangeService } from "../services/token-exchange.service.js";
import type { AuthRouteServicesSlice } from "./auth-container-slices.js";
import { createOidcPhase3Services } from "./create-oidc-phase3-services.js";
import { createSsfServices } from "./create-ssf-services.js";

export function createOidcRouteServices(options: {
  db: Database;
  redis: Redis;
  issuer: string;
  jwks: JwksProvider;
  recentStepUpMaxAgeSec: number;
  environment: "development" | "test" | "production";
}): AuthRouteServicesSlice {
  const oidc = createOidcPhase3Services(options);
  return {
    oidc: {
      ...oidc,
      tokenExchange: new TokenExchangeService(
        createTokenExchangePorts({
          db: options.db,
          issuer: options.issuer,
          jwks: options.jwks,
        }),
      ),
    },
    ssf: createSsfServices({
      db: options.db,
      issuer: options.issuer.replace(/\/+$/, ""),
      jwks: options.jwks,
      environment: options.environment,
    }),
  };
}
