export { createAuth, type Auth, type AuthEnv } from "./server.js";
export { decideSilverAcrStep, type SilverAcrStep } from "./silver-acr-step.js";
export type {
  BreachedPasswordChecker,
  BreachedPasswordCheckResult,
} from "./ports/breached-password-checker.js";
export {
  AUTH_IP_ADDRESS_HEADERS,
  CLIENT_IP_HEADER_NAMES,
  TRUSTED_CLIENT_IP_HEADER,
  readTrustedClientIp,
  stampTrustedClientIp,
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
  HOSTED_THEME_SCRIPT,
  HOSTED_LOGIN_SCRIPT,
  HOSTED_ACCOUNT_CHOOSER_SCRIPT,
  HOSTED_SIGN_UP_SCRIPT,
  HOSTED_FORGOT_PASSWORD_SCRIPT,
  HOSTED_RESET_PASSWORD_SCRIPT,
  HOSTED_TWO_FACTOR_SCRIPT,
  HOSTED_TWO_FACTOR_SETUP_SCRIPT,
  HOSTED_TWO_FACTOR_MANAGE_SCRIPT,
  HOSTED_VERIFY_EMAIL_SCRIPT,
  HOSTED_RESEND_VERIFICATION_SCRIPT,
  HOSTED_MAGIC_LINK_SCRIPT,
  HOSTED_PASSKEY_ADD_SCRIPT,
  HOSTED_CONFIRM_SCRIPT,
  buildHostedAddPasskeyHtml,
  buildHostedPasskeyExpiredHtml,
  buildHostedConfirmHtml,
  hasConfirmMethod,
  type ConfirmMethods,
  type HostedAddPasskeyInput,
  buildHostedLoginHtml,
  buildHostedAccountChooserHtml,
  type HostedAccountChooserIntent,
  buildHostedSignUpHtml,
  buildHostedForgotPasswordHtml,
  buildHostedResetPasswordHtml,
  buildHostedTwoFactorHtml,
  buildHostedTwoFactorHelpHtml,
  buildHostedTwoFactorManageHtml,
  buildHostedTwoFactorPasswordHtml,
  HOSTED_TWO_FACTOR_PASSWORD_SCRIPT,
  buildHostedTwoFactorSetupHtml,
  parseTwoFactorSetupRequiredBy,
  type TwoFactorSetupRequiredBy,
  buildHostedVerifyEmailHtml,
  buildHostedResendVerificationHtml,
  buildHostedMagicLinkHtml,
  hostedAuthViewFromSearch,
  createHostedAuthView,
  parseHostedAuthFlow,
  continuationHref,
  appendOidcAuthorizeParams,
  hostedSignUpRequested,
  normalizeAuthorizePromptForCreate,
  readHostedAssetBytes,
  HOSTED_LOCKUP_ASSET_DIR,
  HOSTED_LOCKUP_BASE_PATH,
  HOSTED_FONT_FILES,
  HOSTED_FONT_ASSET_DIR,
  HOSTED_FONT_BASE_PATH,
  hostedLockupFilename,
  HOSTED_LOCKUP_FILES,
  HOSTED_IMAGE_ASSET_DIR,
  HOSTED_IMAGE_BASE_PATH,
  HOSTED_GALLERY_IMAGE,
  buildHostedErrorHtml,
  isBrowserNavigation,
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
export {
  type PasskeyConfig,
  type PasskeyPorts,
  PASSKEY_USER_VERIFICATION_REQUIRED,
  buildPasskeyPlugin,
  passkeyConfigForIssuer,
} from "./passkey-plugin.js";
export {
  PASSKEY_NOT_ALLOWED,
  PASSKEY_WRONG_PERSON,
} from "./passkey-error-codes.js";
export { SUGGESTED_PASSKEY_NAME_MAX_LENGTH, suggestPasskeyName } from "./passkey-names.js";
export {
  PASSKEY_LIMIT_ERROR_CODE,
  isPasskeyLimitError,
  wrapPasskeyLimitAdapter,
} from "./passkey-limit-adapter.js";

export type { AuthDatabase } from "./phone-number-plugin.js";
export {
  InvalidPhoneNumberError,
  PhoneVerificationRateLimitedError,
} from "./phone-number-errors.js";
export { IDENTITY_EMAIL_TEMPLATE_NAMES } from "./ports/index.js";
export { maskPhoneE164 } from "./mask-phone-e164.js";
export { verifyBearerToken, type VerifiedToken } from "./middleware.js";
export type {
  CredentialEmailInput,
  CredentialEmailSender,
  EmailEnqueueInput,
  EmailSender,
  IdentityEmailTemplate,
  IdentityEventPublisher,
  IdentityLifecycleEvent,
  LegalAcceptanceProduct,
  LegalAcceptanceRecorder,
  LegalAcceptanceSource,
  ProductSubjectUsageProbe,
  SignUpLegalAcceptance,
  AuthPorts,
  PhoneNumberStore,
  SecurityNoticeDelivery,
  SecurityNoticeEvent,
  SecurityNoticePublisher,
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
  stampPasskeyAuthFromResponse,
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
export { readProviderAddress, type ProviderAddress } from "./provider-address.js";
export {
  readSocialSubject,
  type SocialSubjectPorts,
} from "./auth-hooks/social-flow.js";
export { wrapOAuthConsentUpsertAdapter } from "./oauth-consent-upsert.js";
export {
  SOCIAL_PROVIDER_IDS,
  SOCIAL_SIGN_IN_ERROR_CODES,
  decideImplicitLink,
  isSocialProviderId,
  mayUseSocialSignIn,
  type ImplicitLinkBlockReason,
  type ImplicitLinkDecision,
  type SocialProviderId,
  type SocialSubject,
} from "./social-sign-in-policy.js";
