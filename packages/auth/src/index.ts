export { createAuth, type Auth, type AuthEnv } from "./server.js";
export { AUTH_TIMINGS, DEFAULT_JWT_AUDIENCE } from "./auth-timings.js";
export { createEnvelopeCrypto, type EnvelopeCrypto } from "./crypto/envelope.js";
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
export type { AuthDatabase } from "./phone-number-plugin.js";
export {
  InvalidPhoneNumberError,
  PhoneVerificationRateLimitedError,
} from "./phone-number-errors.js";
export { verifyBearerToken, type VerifiedToken } from "./middleware.js";
export type {
  IdentityEventPublisher,
  IdentityLifecycleEvent,
  ProductSubjectUsageProbe,
  AuthPorts,
  PhoneNumberStore,
  SessionStampStore,
} from "./ports/index.js";
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
export { wrapAuthDatabaseAdapter } from "./adapter-at-rest.js";
export { wrapOAuthConsentUpsertAdapter } from "./oauth-consent-upsert.js";
