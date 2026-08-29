import type { IdentityDatabase } from "@auction/identity-db";
import type { Redis } from "ioredis";
import { createIdentityJwtSigner } from "../infrastructure/create-identity-jwt-signer.js";
import type { JwksProvider } from "../infrastructure/jwks-provider.js";
import { createTokenExchangePorts } from "../infrastructure/token-exchange-adapters.js";
import { TokenExchangeService } from "../services/token-exchange.service.js";
import type { AuthRouteServicesSlice } from "./auth-container-slices.js";
import { createOidcPhase3Services } from "./create-oidc-phase3-services.js";
import { createSsfServices } from "./create-ssf-services.js";

export function createOidcRouteServices(options: {
  db: IdentityDatabase;
  redis: Redis;
  issuer: string;
  jwks: JwksProvider;
  authSecret: string;
  recentStepUpMaxAgeSec: number;
  environment: "development" | "test" | "production";
}): AuthRouteServicesSlice {
  const identityJwtSigner = createIdentityJwtSigner({
    jwks: options.jwks,
    authSecret: options.authSecret,
  });
  const oidc = createOidcPhase3Services({ ...options, identityJwtSigner });
  return {
    oidc: {
      ...oidc,
      tokenExchange: new TokenExchangeService(
        createTokenExchangePorts({
          db: options.db,
          issuer: options.issuer,
          jwks: options.jwks,
          signer: identityJwtSigner,
        }),
      ),
    },
    ssf: createSsfServices({
      db: options.db,
      issuer: options.issuer.replace(/\/+$/, ""),
      identityJwtSigner,
      environment: options.environment,
    }),
  };
}
