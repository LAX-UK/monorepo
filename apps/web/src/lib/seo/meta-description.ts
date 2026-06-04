const DEFAULT_MAX_LENGTH = 160;
/**
 * Only trim to the last word boundary when it keeps most of the budget;
 * otherwise (e.g. one very long word) hard-cut to avoid a near-empty result.
 */
const WORD_BOUNDARY_MIN_RATIO = 0.6;

/** Collapse whitespace and trim for meta description / OG text. */
export function normalizeMetaText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Truncate to a max length on a word boundary, appending an ellipsis when shortened.
 * Suitable for meta description and Open Graph description fields.
 */
export function truncateMetaDescription(text: string, maxLength = DEFAULT_MAX_LENGTH): string {
  const normalized = normalizeMetaText(text);
  if (normalized.length <= maxLength) return normalized;

  const slice = normalized.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(" ");
  const trimmed =
    lastSpace > maxLength * WORD_BOUNDARY_MIN_RATIO ? slice.slice(0, lastSpace) : slice;
  return `${trimmed.trimEnd()}…`;
}
