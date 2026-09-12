export { createAuth, type Auth, type AuthEnv } from "./server.js";
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
export {
  OIDC_CONSENT_SCRIPT,
  buildOidcConsentHtml,
} from "./oidc-consent-html.js";
export {
  HOSTED_LOGIN_SCRIPT,
  buildHostedLoginHtml,
} from "./hosted-login-html.js";
export {
  HOSTED_SIGN_UP_SCRIPT,
  buildHostedSignUpHtml,
} from "./hosted-sign-up-html.js";
export {
  HOSTED_FORGOT_PASSWORD_SCRIPT,
  HOSTED_RESET_PASSWORD_SCRIPT,
  buildHostedForgotPasswordHtml,
  buildHostedResetPasswordHtml,
} from "./hosted-forgot-password-html.js";
export {
  HOSTED_TWO_FACTOR_SCRIPT,
  buildHostedTwoFactorHtml,
} from "./hosted-two-factor-html.js";
export {
  HOSTED_VERIFY_EMAIL_SCRIPT,
  buildHostedVerifyEmailHtml,
} from "./hosted-verify-email-html.js";
export {
  HOSTED_RESEND_VERIFICATION_SCRIPT,
  buildHostedResendVerificationHtml,
} from "./hosted-resend-verification-html.js";
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
