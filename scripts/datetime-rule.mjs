/**
 * Which date code belongs in `@auction/datetime`. Formatting a moment or doing zone arithmetic
 * anywhere else is how "Sept", a missing zone name and a hard-wired London crept in, and a time
 * zone that is a parameter instead of a constant needs one place to live.
 *
 * Banned outside packages/datetime (and the self-contained Identity closure): `new Intl.DateTimeFormat(...)`, `toLocaleDateString(...)`,
 * `toLocaleTimeString(...)`, `toLocaleString(...)` on a Date (a Date receiver or date options; number formatting is fine), and importing `@date-fns/tz`. Tests are exempt.
 */
export const DATETIME_PACKAGE_PREFIX = "packages/datetime/";

/**
 * The Identity closure ships and extracts on its own (see scripts/identity/closure.mjs), so it
 * cannot depend on @auction/datetime; its few London date lines stay local and are covered by
 * its own tests. This is the only exemption, and it is a whole closure, never a single file.
 */
export const IDENTITY_CLOSURE_PREFIXES = ["apps/auth/", "packages/identity-contracts/"];

/** The banned constructs, by the name the baseline and the error message use. */
export const BANNED = {
  "Intl.DateTimeFormat": /\b(?:new\s+)?Intl\.DateTimeFormat\s*\(/,
  "toLocale(Date|Time)String": new RegExp(
    [
      // Always a date or a time.
      String.raw`\.toLocale(?:Date|Time)String\s*\(`,
      // toLocaleString is also how numbers are formatted: only a Date receiver or date options count.
      String.raw`\bnew\s+Date\s*\([^()]*\)\s*\.toLocaleString\s*\(`,
      String.raw`\b\w*(?:Date|Time|At|Instant)\s*\.toLocaleString\s*\(`,
      String.raw`\.toLocaleString\s*\([^)]*\b(?:timeZone|dateStyle|timeStyle|hour12|hourCycle|weekday|era|timeZoneName)\b`,
    ].join("|"),
  ),
  "@date-fns/tz": /\b(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)["']@date-fns\/tz["']/,
};

const TEST_FILE_RE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const TEST_DIRECTORY_RE = /(?:^|\/)(?:__tests__|e2e|tests?)\//;

/**
 * True for a production source file the rule applies to.
 * @param {string} rel path relative to the repository root, with forward slashes
 */
export function isScanned(rel) {
  if (rel.startsWith(DATETIME_PACKAGE_PREFIX)) return false;
  if (IDENTITY_CLOSURE_PREFIXES.some((prefix) => rel.startsWith(prefix))) return false;
  return !TEST_FILE_RE.test(rel) && !TEST_DIRECTORY_RE.test(rel);
}

/** Comments name the banned calls in prose; only code counts. */
function withoutComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[\s;{}(),])\/\/.*$/gm, "$1");
}

/**
 * The banned constructs a file uses, as a sorted list of names from `BANNED`.
 * @param {string} rel path relative to the repository root
 * @param {string} text file contents
 */
export function bannedConstructsIn(rel, text) {
  if (!isScanned(rel)) return [];
  const code = withoutComments(text);
  return Object.entries(BANNED)
    .filter(([, pattern]) => pattern.test(code))
    .map(([name]) => name)
    .sort();
}
