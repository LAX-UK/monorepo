export { createAuth, type Auth, type AuthEnv } from "./server.js";
export { AUTH_TIMINGS, DEFAULT_JWT_AUDIENCE } from "./auth-timings.js";
export { createEnvelopeCrypto } from "./crypto/envelope.js";
export { parseAuthDekKey } from "./crypto/dek.js";
export {
  OIDC_CONSENT_SCRIPT,
  buildOidcConsentHtml,
} from "./oidc-consent-html.js";
export {
  createAuctionAuthClient,
  createAuthClientInstance,
  resolveAuthBaseUrl,
  type AuctionAuthClient,
  type AuthClientError,
} from "./client.js";
export * from "./contracts.js";
export { createJwksAdapter } from "./jwks.js";
export { retireExpiredJwksKeys, startJwksRetirementSchedule } from "./jwks-retirement.js";
export { verifyBearerToken, type VerifiedToken } from "./middleware.js";
export * from "./permissions.js";
export {
  runSignInTurnstileGate,
  isSignInEmailPost,
  isSignInMagicLinkPost,
  type SignInGateRedis,
} from "./sign-in-turnstile-gate.js";
export {
  stampLastPasswordAuthFromSignInResponse,
  stampMfaCompletedFromResponse,
} from "./stamp-last-password-auth.js";
export { hasSessionCredential } from "./session-credential.js";
export {
  buildMagicLinkExpiredCallbackUrl,
  buildMagicLinkSetPasswordCallbackUrl,
  isSafeMagicLinkNextPath,
} from "./magic-link-callback.js";
export {
  computeSlidingWindowRetryAfterSec,
  oldestBlockingScoreMs,
  slidingWindowRetryAfterSec,
  type SlidingWindowRedis,
} from "./sliding-window-rate-limit.js";
