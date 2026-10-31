/** Joining and filler words that never give an initial: "Cedar & Stone Fine Art" is CS. */
const SKIPPED = new Set([
  "&",
  "+",
  "and",
  "of",
  "the",
  "for",
  "at",
  "de",
  "la",
  "le",
  "von",
  "van",
]);

/**
 * Two initials for an account or person tile: the first letters of the first two meaningful
 * words ("Cedar & Stone Fine Art" → CS, "Maya Okafor" → MO, "The Hepworth Trust" → HT), or the
 * first two letters of a one-word name. Resilient to empty names and stray punctuation.
 */
export function initials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word && !SKIPPED.has(word.toLowerCase()))
    .map((word) => word.replace(/^[^\p{L}\p{N}]+/u, ""))
    .filter(Boolean);
  const [first, second] = words;
  if (!first) return "?";
  if (!second) return first.slice(0, 2).toUpperCase();
  return `${first[0]}${second[0]}`.toUpperCase();
}
