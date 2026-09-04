import { BACKCHANNEL_LOGOUT_EVENT } from "@auction/identity-contracts";

export { BACKCHANNEL_LOGOUT_EVENT } from "@auction/identity-contracts";
export {
  BACKCHANNEL_LOGOUT_CONCURRENCY,
  BACKCHANNEL_LOGOUT_MAX_ATTEMPTS,
  BACKCHANNEL_LOGOUT_TIMEOUT_MS,
  BackchannelLogoutDeliveryWorker,
  backchannelRetryDelayMs,
  nextBackchannelDeliveryAttempt,
} from "./backchannel-logout-delivery.worker.js";
export {
  BackchannelLogoutRevocationCoordinator as BackchannelLogoutService,
  type BackchannelLogoutRevoker,
} from "./backchannel-logout-revocation.service.js";
export type { LogoutTokenSigner } from "./backchannel-logout.ports.js";

export type LogoutTokenClaims = {
  iss: string;
  aud: string;
  iat: number;
  jti: string;
  events: { [BACKCHANNEL_LOGOUT_EVENT]: Record<string, never> };
  sid?: string;
  sub?: string;
};
