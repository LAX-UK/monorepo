/**
 * Masking helpers shared by the error summary and the payload view. Staff see enough of a value
 * to recognise it (the first letter, the last digits) and never the value itself.
 */

const EMAIL = /([A-Za-z0-9._%+-]+)@([A-Za-z0-9-]+)((?:\.[A-Za-z0-9-]+)+)/g;
const BEARER = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const CREDENTIAL_PAIR =
  /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|passwd|signature|authorization)\b(\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s,;&]+)/gi;
const URL_QUERY = /(https?:\/\/[^\s?#"')]+)\?[^\s"')]*/g;
/** Long unbroken runs of hex, base64 or key-like characters are credentials until shown otherwise. */
const LONG_TOKEN =
  /\b(?![0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b)(?:[A-Za-z0-9_-]{32,}|(?:sk|pk|rk|whsec|xox[a-z])_[A-Za-z0-9_]{8,})\b/g;
/** A number with a leading plus, or digits in the groups a phone number is written in. */
const PHONE =
  /(?<![\w.])\+\d[\d\s().-]{8,}\d(?![\w.])|(?<![\w.-])\(?\d{3,5}\)?[\s.-]\d{3,4}[\s.-]\d{3,4}(?![\w.-])/g;

const BULLETS = "•••••";

/** `lena@north.com` becomes `l•••••@n•••••.com`. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return BULLETS;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${local.charAt(0)}${BULLETS}@${host.charAt(0)}${BULLETS}${tld}`;
}

/** `Lena Fischer` becomes `L. F•••`. */
export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return BULLETS;
  if (parts.length === 1) return `${parts[0]?.charAt(0)}•••`;
  const [first, ...rest] = parts;
  const last = rest[rest.length - 1] ?? "";
  return `${first?.charAt(0)}. ${last.charAt(0)}•••`;
}

/** A phone number keeps its last three digits. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length < 4 ? BULLETS : `${BULLETS}${digits.slice(-3)}`;
}

/** Removes emails, credentials, query strings, long tokens and phone numbers from free text. */
export function scrubText(text: string): string {
  return text
    .replace(BEARER, "$1 [removed]")
    .replace(CREDENTIAL_PAIR, "$1$2[removed]")
    .replace(EMAIL, (match) => maskEmail(match))
    .replace(URL_QUERY, "$1")
    .replace(LONG_TOKEN, "[removed]")
    .replace(PHONE, (match) => maskPhone(match));
}
