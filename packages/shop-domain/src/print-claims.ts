/**
 * Words the Shop never uses to describe a print in staff-editable text (descriptions, stories,
 * exhibitions). What a print promises is stated once, in its Edition facts, and worded by
 * describeEditionFacts; free text cannot add to it. The list lives here and nowhere else.
 */
export const PRINT_CLAIM_WORDS = [
  "museum quality",
  "investment",
  "guaranteed",
  "certified",
  "rare",
  "authenticated",
] as const;

export type PrintClaimWord = (typeof PRINT_CLAIM_WORDS)[number];

export const PRINT_CLAIM_MESSAGE =
  "Shop descriptions can't make claims about the print. Use the Edition facts card instead.";

/** A letter or digit on either side means the match is only part of a longer word. */
const WHOLE = (forms: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${forms})(?![\\p{L}\\p{N}])`, "iu");

/**
 * Each claim word with the forms of it that are blocked, written out so nothing depends on
 * guessing: a space or hyphen joins a two-word claim ("museum quality", "museum-quality"),
 * "investment-grade" is caught by "investment", and "rarefied" or "prepare" are not claims.
 */
const PATTERNS: ReadonlyArray<readonly [PrintClaimWord, RegExp]> = [
  ["museum quality", WHOLE("museum[\\s-]+quality")],
  ["investment", WHOLE("invest(?:ment|ments|ing)")],
  ["guaranteed", WHOLE("guarantee[sd]?")],
  ["certified", WHOLE("certif(?:y|ied)|certificate-backed")],
  ["rare", WHOLE("rar(?:e|er|est|ity|ities)")],
  ["authenticated", WHOLE("authenticat(?:ed|ion)")],
];

/**
 * The first claim word in `text`, or null. "Certified" is allowed once the run states a
 * certificate in its facts, because then the word is true and the facts say who issued it.
 */
export function findPrintClaimWord(
  text: string,
  options: { certificateStated?: boolean } = {},
): PrintClaimWord | null {
  for (const [word, pattern] of PATTERNS) {
    if (word === "certified" && options.certificateStated) continue;
    if (pattern.test(text)) return word;
  }
  return null;
}
