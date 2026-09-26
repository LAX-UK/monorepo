export {
  IdentityRejectedError,
  IdentityUnavailableError,
  isIdentityRejected,
  isIdentityUnavailable,
  throwTokenEndpointFailure,
} from "./errors.js";
export {
  generateOAuthLoginParams,
  validateOAuthStateExact,
  validateOAuthStateTimingSafe,
  type OAuthLoginParams,
} from "./pkce.js";
export type { OidcAuthorizePrompt } from "./authorize-prompt.js";
export { OIDC_AUTHORIZE_PROMPTS, isOidcAuthorizePrompt } from "./authorize-prompt.js";
export { assertRecentAuthentication } from "./auth-time.js";
export type { AssertRecentAuthenticationInput } from "./auth-time.js";
export { buildAuthorizeUrl } from "./authorize-url.js";
export { buildEndSessionUrl } from "./end-session-url.js";
export {
  mergeRefreshTokens,
  parseBearerTokenResponse,
  type OidcTokenResponse,
} from "./token-codec.js";
export type { TokenEndpoint } from "./ports/token-endpoint.js";
export {
  createFetchTokenEndpoint,
  type FetchTokenEndpointAuth,
} from "./adapters/fetch-token-endpoint.js";
export type { CookieJar, CookieSetOptions } from "./silent-sign-in/ports/cookie-jar.js";
export {
  classifySilentCallback,
  type SilentCallbackClassification,
} from "./silent-sign-in/callback-outcome.js";
export {
  evaluateSilentSignInCookieGate,
  evaluateSilentSignInEligibility,
  type EvaluateSilentSignInCookieGateInput,
  type EvaluateSilentSignInEligibilityInput,
  type SilentSignInCookieGate,
  type SilentSignInEligibility,
  type SilentSignInRequest,
} from "./silent-sign-in/eligibility.js";
export {
  isDocumentNavigation,
  isLikelyCrawler,
  isPrefetch,
  type HeaderGetter,
} from "./silent-sign-in/request-signals.js";
export {
  createSilentSignInCookieSpec,
  defaultCookieSetOptions,
  DEFAULT_SILENT_SIGN_IN_MAX_AGES,
  type SilentSignInCookieNames,
} from "./silent-sign-in/silent-sign-in-cookies.js";
export {
  requestSilentFedcmCredential,
  selectSilentSignInStrategy,
  type NavigatorCredentialsLike,
  type SilentSignInStrategy,
} from "./silent-sign-in/strategy.js";
