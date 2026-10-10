export { createAuth, type Auth, type AuthEnv } from "./server.js";
export { decideSilverAcrStep, type SilverAcrStep } from "./silver-acr-step.js";
export type {
  BreachedPasswordChecker,
  BreachedPasswordCheckResult,
} from "./ports/breached-password-checker.js";
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
  HOSTED_TWO_FACTOR_SETUP_SCRIPT,
  HOSTED_TWO_FACTOR_MANAGE_SCRIPT,
  HOSTED_VERIFY_EMAIL_SCRIPT,
  HOSTED_RESEND_VERIFICATION_SCRIPT,
  HOSTED_MAGIC_LINK_SCRIPT,
  buildHostedLoginHtml,
  buildHostedSignUpHtml,
  buildHostedForgotPasswordHtml,
  buildHostedResetPasswordHtml,
  buildHostedTwoFactorHtml,
  buildHostedTwoFactorManageHtml,
  buildHostedTwoFactorSetupHtml,
  parseTwoFactorSetupRequiredBy,
  type TwoFactorSetupRequiredBy,
  buildHostedVerifyEmailHtml,
  buildHostedResendVerificationHtml,
  buildHostedMagicLinkHtml,
  hostedAuthViewFromSearch,
  createHostedAuthView,
  parseHostedAuthFlow,
  appendOidcAuthorizeParams,
  hostedSignUpRequested,
  normalizeAuthorizePromptForCreate,
  readHostedBidLogoLightSvg,
  readHostedBidLogoSvg,
  readHostedShopLogoSvg,
  readHostedAsset,
  readHostedFaviconBytes,
  HOSTED_AUTH_FAVICON_BASE_PATH,
  HOSTED_FAVICON_ASSET_NAMES,
  hostedFaviconContentType,
  type HostedFaviconAssetName,
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
  AccessMarker,
  TwoFactorPolicy,
  TwoFactorPolicyRecord,
  TwoFactorPolicyScope,
  TwoFactorPolicyStore,
} from "./ports/index.js";
export {
  decideAuthorizeTwoFactorStep,
  resolveTwoFactorRequirement,
  TWO_FACTOR_POLICY_DEFAULTS,
  type TwoFactorRequirement,
  type TwoFactorRequirementSource,
} from "./two-factor-requirement.js";
export {
  runSignInTurnstileGate,
  isSignInEmailPost,
  isSignInMagicLinkPost,
  type SignInGateRedis,
} from "./sign-in-turnstile-gate.js";
export {
  stampLastPasswordAuthFromSignInResponse,
  stampMfaCompletedFromResponse,
  stampSocialAuthFromResponse,
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
