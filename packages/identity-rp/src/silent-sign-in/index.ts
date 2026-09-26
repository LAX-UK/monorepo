/** Edge-safe silent sign-in exports (no Node crypto / PKCE). */
export {
  classifySilentCallback,
  type SilentCallbackClassification,
} from "./callback-outcome.js";
export {
  evaluateSilentSignInCookieGate,
  evaluateSilentSignInEligibility,
  type EvaluateSilentSignInCookieGateInput,
  type EvaluateSilentSignInEligibilityInput,
  type SilentSignInCookieGate,
  type SilentSignInEligibility,
  type SilentSignInRequest,
} from "./eligibility.js";
export type { CookieJar, CookieSetOptions } from "./ports/cookie-jar.js";
export {
  isDocumentNavigation,
  isLikelyCrawler,
  isPrefetch,
  type HeaderGetter,
} from "./request-signals.js";
export {
  createSilentSignInCookieSpec,
  defaultCookieSetOptions,
  DEFAULT_SILENT_SIGN_IN_MAX_AGES,
  type SilentSignInCookieNames,
} from "./silent-sign-in-cookies.js";
export {
  requestSilentFedcmCredential,
  selectSilentSignInStrategy,
  type NavigatorCredentialsLike,
  type SilentSignInStrategy,
} from "./strategy.js";
