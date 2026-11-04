/**
 * A home section leads with its words, not placeholders, when none of its items has an image:
 * a row of identical hatched frames says nothing. A section where some items have images keeps
 * the frames so its cards stay one height.
 */
export function isTextLedSection(items: readonly { imageUrl: string | null }[]): boolean {
  return items.length > 0 && items.every((item) => !item.imageUrl);
}
