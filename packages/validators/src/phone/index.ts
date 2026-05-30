export {
  getPhoneCountryOptions,
  isValidCountryCode,
  splitE164ForForm,
  type PhoneCountryOption,
} from "./countries.js";
export {
  normalizeLegacyMobile,
  normalizePhoneInput,
  phoneDigitsForPiiHash,
  toCountryCode,
  type NormalizePhoneResult,
  type NormalizedPhone,
  type PhoneInput,
} from "./normalize.js";
export { formatPhoneDisplay } from "./display.js";
export { resolvePhoneFromBody, type PhoneInputValues, type ResolvePhoneResult } from "./resolve.js";
