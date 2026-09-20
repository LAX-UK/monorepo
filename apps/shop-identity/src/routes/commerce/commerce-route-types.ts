import type { ShopIdentityTokenService } from "../../application/shop-identity-token.service.js";
import type { ShopIdentityEnv } from "../../env.js";
import type { ShopApiClientOptions, shopApiFetch } from "../../infrastructure/shop-api.client.js";
import type { ShopSessionRepository } from "../../session.js";

export type CommerceRoutesDeps = {
  env: ShopIdentityEnv;
  secureCookies: boolean;
  sessionRepository: ShopSessionRepository;
  tokenService: ShopIdentityTokenService;
  shopApi: ShopApiClientOptions;
  shopApiFetch: typeof shopApiFetch;
};
