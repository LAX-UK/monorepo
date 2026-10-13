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
};

export type ImportArtworkFormResult =
  | { ok: true; input: ImportArtworkFormInput }
  | { ok: false; error: "missing_required" | "medium_too_long" };

/** A blank medium is sent as `null`, which clears any stored value on re-import. */
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
    },
  };
}
