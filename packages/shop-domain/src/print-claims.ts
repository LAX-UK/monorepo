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
  "authenticated by",
] as const;

export type PrintClaimWord = (typeof PRINT_CLAIM_WORDS)[number];

export const PRINT_CLAIM_MESSAGE =
  "Shop descriptions can't make claims about the print. Use the Edition facts card instead.";

// The words are plain letters and spaces: a space matches any run of whitespace, and a word
// matches only whole, so "rare" does not match "rarefied" or "prepare".
const PATTERNS: ReadonlyArray<readonly [PrintClaimWord, RegExp]> = PRINT_CLAIM_WORDS.map((word) => [
  word,
  new RegExp(`(?<![\\p{L}\\p{N}])${word.replace(/ /g, "\\s+")}(?![\\p{L}\\p{N}])`, "iu"),
]);

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
