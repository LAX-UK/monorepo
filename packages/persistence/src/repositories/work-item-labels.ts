/** "Fulfilment — Lot 4: Title"; a lot without a number reads "Fulfilment — Title". */
export function lotWorkItemTitle(
  prefix: string,
  lotNumber: number | null,
  lotTitle: string,
): string {
  return lotNumber != null
    ? `${prefix} — Lot ${lotNumber}: ${lotTitle}`
    : `${prefix} — ${lotTitle}`;
}

/** "awaiting_release" as "Awaiting release". */
export function sentenceCase(snake: string): string {
  const text = snake.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
