import {
  ARTWORK_SLUG_IN_USE_MESSAGE,
  type AdminLaxArtOfferBody,
  CATALOGUE_SLUG_MAX_LENGTH,
  CATALOGUE_SLUG_PATTERN,
  type LAX_ART_OFFER_SALE_STATES,
} from "@auction/shop-contracts";
import { slugify } from "./slugify";

export type OfferOnLaxArtSaleState = (typeof LAX_ART_OFFER_SALE_STATES)[number];

export type OfferOnLaxArtForm = {
  artistId: string | null;
  artistName: string | null;
  saleState: OfferOnLaxArtSaleState;
  slug: string;
  /** False until staff edit the web address by hand; until then it follows the artist and title. */
  slugEdited: boolean;
};

export type OfferOnLaxArtField = "artistId" | "slug";

export const OFFER_ON_LAX_ART_FIELDS: readonly OfferOnLaxArtField[] = ["artistId", "slug"];

const SLUG_PATTERN = new RegExp(CATALOGUE_SLUG_PATTERN);

/** The web address Zoho's artist and title suggest: "ada-rowe-tidal-margin-iv". */
export function suggestedSlug(artistName: string | null, title: string): string {
  return slugify([artistName, title].filter(Boolean).join(" "), CATALOGUE_SLUG_MAX_LENGTH);
}

export function offerOnLaxArtForm(input: {
  matchedArtist: { artistId: string; displayName: string } | null;
  zohoArtistName: string;
  title: string;
}): OfferOnLaxArtForm {
  const artistName = input.matchedArtist?.displayName ?? null;
  return {
    artistId: input.matchedArtist?.artistId ?? null,
    artistName,
    saleState: "for_sale",
    slug: suggestedSlug(artistName ?? input.zohoArtistName, input.title),
    slugEdited: false,
  };
}

/** Choosing an artist moves the suggested web address with it, until staff take it over. */
export function withArtist(
  form: OfferOnLaxArtForm,
  artist: { id: string; label: string } | null,
  title: string,
): OfferOnLaxArtForm {
  const next = { ...form, artistId: artist?.id ?? null, artistName: artist?.label ?? null };
  return form.slugEdited ? next : { ...next, slug: suggestedSlug(next.artistName, title) };
}

export function validateOfferOnLaxArtForm(
  form: OfferOnLaxArtForm,
  zohoArtistName: string,
): Partial<Record<OfferOnLaxArtField, string>> {
  const errors: Partial<Record<OfferOnLaxArtField, string>> = {};
  if (!form.artistId) errors.artistId = `Choose the lax.art artist for ${zohoArtistName}.`;
  const slug = form.slug.trim();
  if (!slug) errors.slug = "Enter a web address.";
  else if (slug.length > CATALOGUE_SLUG_MAX_LENGTH || !SLUG_PATTERN.test(slug)) {
    errors.slug = "Use lower case words joined by hyphens, such as ada-rowe-tidal-margin-iv.";
  }
  return errors;
}

export function offerOnLaxArtFieldId(field: OfferOnLaxArtField): string {
  return `offer-lax-art-${field}`;
}

export function offerOnLaxArtErrorSummary(
  errors: Partial<Record<OfferOnLaxArtField, string>>,
): Array<{ fieldId: string; message: string }> {
  return OFFER_ON_LAX_ART_FIELDS.flatMap((field) => {
    const message = errors[field];
    return message ? [{ fieldId: offerOnLaxArtFieldId(field), message }] : [];
  });
}

/** The request body for a form that passed validation. */
export function offerOnLaxArtBody(form: OfferOnLaxArtForm): AdminLaxArtOfferBody | null {
  if (!form.artistId) return null;
  return { artistId: form.artistId, saleState: form.saleState, slug: form.slug.trim() };
}

/** The server's "web address taken" refusal, shown on the web address field. */
export const SLUG_TAKEN_MESSAGE =
  "This web address is used by another artwork. Change it to continue.";

export function offerConflictField(message: string): OfferOnLaxArtField | null {
  return message === ARTWORK_SLUG_IN_USE_MESSAGE ? "slug" : null;
}

/** "There is a problem" for one error, "There are 2 problems" for more. */
export function problemsTitle(count: number): string {
  return count === 1 ? "There is a problem" : `There are ${count} problems`;
}
