/** Short header blurb — full copy lives on the overview tab. */
export function clampCatalogDescription(
  description: string | null | undefined,
  maxLen = 200,
): string | undefined {
  if (!description?.trim()) return undefined;
  const trimmed = description.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 3)}…`;
}
