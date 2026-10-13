export type SeoOverrides = { seoTitle?: string | null; seoDescription?: string | null };

const BRAND_SUFFIX = " | LAX Art";
export const META_DESCRIPTION_MAX_LENGTH = 160;

/** Overrides are used verbatim: imported legacy titles already carry their branding. */
export function seoMetadataTitle(overrides: SeoOverrides, fallbackTitle: string): string {
  return overrides.seoTitle?.trim() || `${fallbackTitle}${BRAND_SUFFIX}`;
}

export function seoMetadataDescription(
  overrides: SeoOverrides,
  fallback: string | null | undefined,
): string | undefined {
  const override = overrides.seoDescription?.trim();
  if (override) return override;
  const text = fallback?.replace(/\s+/g, " ").trim();
  return text ? truncateMetaDescription(text) : undefined;
}

export function truncateMetaDescription(text: string): string {
  if (text.length <= META_DESCRIPTION_MAX_LENGTH) return text;
  const cut = text.slice(0, META_DESCRIPTION_MAX_LENGTH - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}
