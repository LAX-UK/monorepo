import { type SeoFieldsFormError, parseSeoFieldsPatch } from "./seo-fields-form";

export const ARTWORK_MEDIUM_MAX_LENGTH = 200;

export type ImportArtworkFormFields = {
  importKey: string;
  slug: string;
  title: string;
  medium: string;
  primaryImageUrl: string | null;
  artistSlug: string;
  artistDisplayName: string;
  eligibleForEditionAllocation: boolean;
  seoTitle?: string;
  seoDescription?: string;
};

export type ImportArtworkFormInput = {
  importKey: string;
  slug: string;
  title: string;
  description: null;
  primaryImageUrl: string | null;
  medium: string | null;
  artistSlug: string;
  artistDisplayName: string;
  eligibleForEditionAllocation: boolean;
  seoTitle?: string;
  seoDescription?: string;
};

export type ImportArtworkFormResult =
  | { ok: true; input: ImportArtworkFormInput }
  | { ok: false; error: "missing_required" | "medium_too_long" | SeoFieldsFormError };

/**
 * A blank medium is sent as `null`, which clears any stored value on re-import.
 * Blank SEO overrides are omitted so a re-import keeps imported legacy metadata.
 */
export function buildImportArtworkInput(fields: ImportArtworkFormFields): ImportArtworkFormResult {
  const importKey = fields.importKey.trim();
  const slug = fields.slug.trim();
  const title = fields.title.trim();
  const artistSlug = fields.artistSlug.trim();
  const artistDisplayName = fields.artistDisplayName.trim();
  if (!importKey || !slug || !title || !artistSlug || !artistDisplayName) {
    return { ok: false, error: "missing_required" };
  }
  const medium = fields.medium.trim();
  if (medium.length > ARTWORK_MEDIUM_MAX_LENGTH) {
    return { ok: false, error: "medium_too_long" };
  }
  const seo = parseSeoFieldsPatch({
    seoTitle: fields.seoTitle ?? "",
    seoDescription: fields.seoDescription ?? "",
  });
  if (!seo.ok) return seo;
  return {
    ok: true,
    input: {
      importKey,
      slug,
      title,
      description: null,
      primaryImageUrl: fields.primaryImageUrl?.trim() || null,
      medium: medium.length > 0 ? medium : null,
      artistSlug,
      artistDisplayName,
      eligibleForEditionAllocation: fields.eligibleForEditionAllocation,
      ...seo.fields,
    },
  };
}
