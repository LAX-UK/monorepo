import {
  ARTIST_DISCIPLINE_MAX_LENGTH,
  ARTIST_NAME_MAX_LENGTH,
  ARTIST_SLUG_IN_USE_MESSAGE,
  type AdminArtistCreateBody,
  CATALOGUE_SLUG_MAX_LENGTH,
  CATALOGUE_SLUG_PATTERN,
} from "@auction/shop-contracts";
import { slugify } from "./slugify";

export type ArtistFormValues = {
  displayName: string;
  slug: string;
  /** False until staff edit the slug; until then it follows the name. */
  slugEdited: boolean;
  discipline: string;
};

export type ArtistFormField = "displayName" | "slug" | "discipline";

export const EMPTY_ARTIST_FORM: ArtistFormValues = {
  displayName: "",
  slug: "",
  slugEdited: false,
  discipline: "",
};

const SLUG_PATTERN = new RegExp(CATALOGUE_SLUG_PATTERN);

export function withArtistName(values: ArtistFormValues, displayName: string): ArtistFormValues {
  return values.slugEdited
    ? { ...values, displayName }
    : { ...values, displayName, slug: slugify(displayName, CATALOGUE_SLUG_MAX_LENGTH) };
}

export function validateArtistForm(
  values: ArtistFormValues,
): Partial<Record<ArtistFormField, string>> {
  const errors: Partial<Record<ArtistFormField, string>> = {};
  const name = values.displayName.trim();
  if (!name) errors.displayName = "Enter the artist's name.";
  else if (name.length > ARTIST_NAME_MAX_LENGTH) {
    errors.displayName = `The name must be ${ARTIST_NAME_MAX_LENGTH} characters or fewer.`;
  }
  const slug = values.slug.trim();
  if (!slug) errors.slug = "Enter the web address slug.";
  else if (slug.length > CATALOGUE_SLUG_MAX_LENGTH) {
    errors.slug = `The slug must be ${CATALOGUE_SLUG_MAX_LENGTH} characters or fewer.`;
  } else if (!SLUG_PATTERN.test(slug)) {
    errors.slug = "Use lower case letters, numbers and single hyphens, such as ada-lovelace.";
  }
  if (values.discipline.trim().length > ARTIST_DISCIPLINE_MAX_LENGTH) {
    errors.discipline = `The discipline must be ${ARTIST_DISCIPLINE_MAX_LENGTH} characters or fewer.`;
  }
  return errors;
}

export function buildArtistCreateBody(values: ArtistFormValues): AdminArtistCreateBody {
  return {
    displayName: values.displayName.trim(),
    slug: values.slug.trim(),
    discipline: values.discipline.trim() || null,
  };
}

/** A taken slug belongs on the slug field; other refusals show above the form. */
export function artistConflictField(message: string): ArtistFormField | null {
  return message === ARTIST_SLUG_IN_USE_MESSAGE ? "slug" : null;
}
