export { createAuth, type Auth, type AuthEnv } from "./server.js";
export {
  AUTH_IP_ADDRESS_HEADERS,
  CLIENT_IP_HEADER_NAMES,
  readForwardedClientIp,
} from "./client-ip-headers.js";
export { AUTH_TIMINGS, DEFAULT_JWT_AUDIENCE } from "./auth-timings.js";
export { createEnvelopeCrypto, type EnvelopeCrypto } from "./crypto/envelope.js";
export { parseAuthDekKey } from "./crypto/dek.js";
export {
  AUTH_AT_REST_ENVELOPE_PREFIX,
  AUTH_AT_REST_TOKEN_HASH_PREFIX,
  isEnvelopeSealed,
  isOpaqueTokenFingerprint,
} from "./at-rest/constants.js";
export { hashOpaqueToken } from "./at-rest/token-fingerprint.js";
export {
  accountTokensNeedUpdate,
  oauthAccessTokenNeedsUpdate,
  transformAccountTokens,
  transformJwksPrivateJwk,
  transformOauthAccessToken,
  transformTwoFactor,
  twoFactorNeedsUpdate,
  type AccountTokenRow,
  type OauthAccessTokenRow,
  type TwoFactorRow,
} from "./at-rest/transform.js";
export { OIDC_CONSENT_SCRIPT, buildOidcConsentHtml } from "./hosted-auth/index.js";
export {
  HOSTED_AUTH_STYLES,
  HOSTED_AUTH_RUNTIME_SCRIPT,
  HOSTED_LOGIN_SCRIPT,
  HOSTED_SIGN_UP_SCRIPT,
  HOSTED_FORGOT_PASSWORD_SCRIPT,
  HOSTED_RESET_PASSWORD_SCRIPT,
  HOSTED_TWO_FACTOR_SCRIPT,
  HOSTED_VERIFY_EMAIL_SCRIPT,
  HOSTED_RESEND_VERIFICATION_SCRIPT,
  HOSTED_MAGIC_LINK_SCRIPT,
  HOSTED_PHONE_SCRIPT,
  buildHostedLoginHtml,
  buildHostedSignUpHtml,
  buildHostedForgotPasswordHtml,
  buildHostedResetPasswordHtml,
  buildHostedTwoFactorHtml,
  buildHostedVerifyEmailHtml,
  buildHostedResendVerificationHtml,
  buildHostedMagicLinkHtml,
  buildHostedPhoneHtml,
  hostedAuthViewFromSearch,
  createHostedAuthView,
  parseHostedAuthFlow,
  readHostedShopLogoSvg,
  readHostedAsset,
  type HostedAuthCapabilities,
  type HostedAuthView,
} from "./hosted-auth/index.js";
export { isSafeHostedReturnPath, resolveHostedReturnUrl } from "./safe-return-url.js";
export * from "./contracts.js";
export type { AuthDatabase } from "./phone-number-plugin.js";
export {
  InvalidPhoneNumberError,
  PhoneVerificationRateLimitedError,
} from "./phone-number-errors.js";
export { IDENTITY_EMAIL_TEMPLATE_NAMES } from "./ports/index.js";
export { verifyBearerToken, type VerifiedToken } from "./middleware.js";
export type {
  EmailEnqueueInput,
  EmailSender,
  IdentityEmailTemplate,
  IdentityEventPublisher,
  IdentityLifecycleEvent,
  ProductSubjectUsageProbe,
  AuthPorts,
  PhoneNumberStore,
  SendOtpOptions,
  SessionStampStore,
  SmsSender,
  SubjectStatusReader,
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
