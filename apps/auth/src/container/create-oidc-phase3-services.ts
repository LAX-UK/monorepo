import type { Database } from "@auction/db";
import type { Redis } from "ioredis";
import {
  DrizzleBackchannelLogoutDeliveryRepository,
  DrizzleRpLogoutRepository,
} from "../infrastructure/drizzle-backchannel-logout.adapters.js";
import { HttpBackchannelLogoutDispatcher } from "../infrastructure/http-backchannel-logout.dispatcher.js";
import {
  DrizzleOidcRpSessionRepository,
  RedisOidcCodeCorrelationStore,
} from "../infrastructure/oidc-session-adapters.js";
import {
  DrizzleConfidentialClientAuthenticator,
  type JwksProvider,
  createLogoutTokenSigner,
} from "../infrastructure/token-exchange-adapters.js";
import { BackchannelLogoutDeliveryWorker } from "../services/backchannel-logout-delivery.worker.js";
import { BackchannelLogoutRevocationCoordinator } from "../services/backchannel-logout-revocation.service.js";
import { OauthTokenManagementService } from "../services/oauth-token-management.service.js";
import { OidcSessionCoordinator } from "../services/oidc-session-coordinator.js";

export function createOidcPhase3Services(options: {
  db: Database;
  redis: Redis;
  issuer: string;
  jwks: JwksProvider;
  recentStepUpMaxAgeSec: number;
}) {
  const signer = createLogoutTokenSigner(options.jwks);
  const logout = new BackchannelLogoutRevocationCoordinator(
    new DrizzleRpLogoutRepository(options.db),
  );
  return {
    sessions: new OidcSessionCoordinator(
      new RedisOidcCodeCorrelationStore(options.redis),
      new DrizzleOidcRpSessionRepository(options.db),
      options.recentStepUpMaxAgeSec,
    ),
    confidentialClients: new DrizzleConfidentialClientAuthenticator(options.db),
    tokenManagement: new OauthTokenManagementService(options.db, options.issuer, options.jwks),
    logout,
    logoutDelivery: new BackchannelLogoutDeliveryWorker(
      new DrizzleBackchannelLogoutDeliveryRepository(options.db),
      options.issuer,
      signer,
      new HttpBackchannelLogoutDispatcher(),
    ),
  };
}
