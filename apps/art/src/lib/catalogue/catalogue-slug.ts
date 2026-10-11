const MAX_SLUG_LENGTH = 200;

/** Guards slugs arriving from forms or client islands before they reach a BFF path. */
export function isCatalogueSlug(slug: unknown): slug is string {
  return typeof slug === "string" && slug.trim().length > 0 && slug.length <= MAX_SLUG_LENGTH;
}
