/**
 * Which date code belongs in `@auction/datetime`. Formatting a moment or doing zone arithmetic
 * anywhere else is how "Sept", a missing zone name and a hard-wired London crept in, and a time
 * zone that is a parameter instead of a constant needs one place to live.
 *
 * Banned outside packages/datetime: `new Intl.DateTimeFormat(...)`, `toLocaleDateString(...)`,
 * `toLocaleTimeString(...)`, `toLocaleString(...)`, and importing `@date-fns/tz`. Tests are exempt.
 */
export const DATETIME_PACKAGE_PREFIX = "packages/datetime/";

/** The banned constructs, by the name the baseline and the error message use. */
export const BANNED = {
  "Intl.DateTimeFormat": /\b(?:new\s+)?Intl\.DateTimeFormat\s*\(/,
  "toLocale(Date|Time)String": /\.toLocale(?:Date|Time)?String\s*\(/,
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
