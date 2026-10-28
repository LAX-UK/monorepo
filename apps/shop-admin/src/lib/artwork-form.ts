import {
  ARTWORK_DESCRIPTION_MAX_LENGTH,
  ARTWORK_DIMENSIONS_MAX_LENGTH,
  ARTWORK_EDITION_PRICE_MAX_PENCE,
  ARTWORK_IMAGES_MAX,
  ARTWORK_IMAGE_ALT_MAX_LENGTH,
  ARTWORK_MEDIUM_MAX_LENGTH,
  ARTWORK_SLUG_IN_USE_MESSAGE,
  ARTWORK_TITLE_MAX_LENGTH,
  ARTWORK_YEAR_MIN,
  type AdminArtworkChannel,
  type AdminArtworkCreateBody,
  type AdminArtworkDetail,
  type AdminArtworkSaleState,
  type AdminArtworkUpdateBody,
  type AdminNewRunInput,
  CATALOGUE_SLUG_MAX_LENGTH,
  CATALOGUE_SLUG_PATTERN,
  SEO_DESCRIPTION_MAX_LENGTH,
  SEO_TITLE_MAX_LENGTH,
} from "@auction/shop-contracts";
import { formatGbp, formatPenceAsPounds, parsePoundsToPence } from "@auction/staff-ui";
import type { FieldErrors } from "./form-validation";
import { slugify } from "./slugify";

/*
 * The artwork editor's form state and rules, kept apart from the component so they are tested
 * without rendering. Prices are typed in pounds and held in pence; the API stores pence.
 */

export type ArtworkFormImage = { mediaKey: string; url: string | null; alt: string };

export type ArtworkFormValues = {
  title: string;
  slug: string;
  /** False until staff edit the slug by hand; until then it follows the title. */
  slugEdited: boolean;
  artistId: string | null;
  artistName: string | null;
  yearCreated: string;
  medium: string;
  dimensions: string;
  description: string;
  /** Chosen at creation only: prints for LAX Shop (a run), or an original for lax.art. */
  editionRun: "editions" | "original";
  /** What is in the price field, exactly as typed; pence is derived from it. */
  priceText: string;
  saleState: AdminArtworkSaleState;
  salesChannel: AdminArtworkChannel;
  /** For an edition: the original on lax.art it was made from, and its title for the picker. */
  sourceOriginalId: string | null;
  sourceOriginalTitle: string | null;
  images: ArtworkFormImage[];
  seoTitle: string;
  seoDescription: string;
};

export type ArtworkFormMode = "create" | "edit";

export type ArtworkFormContext = {
  mode: ArtworkFormMode;
  /** `artwork_price.write`; without it the price field is read-only. */
  canSetPrice: boolean;
  /** Published and not archived: a live edition run on sale must keep its price. */
  live: boolean;
  /** The year now, so "next year" is the latest a work can be dated. */
  currentYear: number;
};

/** Field names in page order, with the id each control renders, for the error summary links. */
export const ARTWORK_FORM_FIELDS = [
  "title",
  "slug",
  "artistId",
  "yearCreated",
  "medium",
  "dimensions",
  "description",
  "price",
  "images",
  "seoTitle",
  "seoDescription",
] as const;
export type ArtworkFormField = (typeof ARTWORK_FORM_FIELDS)[number];

export function artworkFieldId(field: ArtworkFormField): string {
  return `artwork-${field}`;
}

const SLUG_PATTERN = new RegExp(CATALOGUE_SLUG_PATTERN);

function penceToText(pence: number | null): string {
  return pence === null ? "" : formatPenceAsPounds(pence);
}

export function emptyArtworkForm(): ArtworkFormValues {
  return {
    title: "",
    slug: "",
    slugEdited: false,
    artistId: null,
    artistName: null,
    yearCreated: "",
    medium: "",
    dimensions: "",
    description: "",
    editionRun: "editions",
    priceText: "",
    saleState: "for_sale",
    salesChannel: "shop",
    sourceOriginalId: null,
    sourceOriginalTitle: null,
    images: [],
    seoTitle: "",
    seoDescription: "",
  };
}

export function artworkFormValues(detail: AdminArtworkDetail): ArtworkFormValues {
  return {
    title: detail.title,
    slug: detail.slug,
    slugEdited: true,
    artistId: detail.artist.artistId,
    artistName: detail.artist.displayName,
    yearCreated: detail.yearCreated === null ? "" : String(detail.yearCreated),
    medium: detail.medium ?? "",
    dimensions: detail.dimensions ?? "",
    description: detail.description ?? "",
    editionRun: detail.run ? "editions" : "original",
    priceText: penceToText(detail.printPricePence),
    saleState: detail.saleState,
    salesChannel: detail.salesChannel,
    sourceOriginalId: detail.sourceOriginal?.artworkId ?? null,
    sourceOriginalTitle: detail.sourceOriginal?.title ?? null,
    images: detail.images.map((image) => ({
      mediaKey: image.mediaKey,
      url: image.url,
      alt: image.alt ?? "",
    })),
    seoTitle: detail.seoTitle ?? "",
    seoDescription: detail.seoDescription ?? "",
  };
}

/** Typing a title fills the slug until staff take the slug over. */
export function withTitle(values: ArtworkFormValues, title: string): ArtworkFormValues {
  return values.slugEdited
    ? { ...values, title }
    : { ...values, title, slug: slugify(title, CATALOGUE_SLUG_MAX_LENGTH) };
}

type ParsedPrice = { ok: true; pence: number | null } | { ok: false; message: string };

const MAX_PRICE_LABEL = formatGbp(ARTWORK_EDITION_PRICE_MAX_PENCE);

/** The price field as pence: blank is no price; anything else must be a positive amount. */
export function parseArtworkPrice(text: string): ParsedPrice {
  if (!text.trim()) return { ok: true, pence: null };
  const parsed = parsePoundsToPence(text);
  if (!parsed.ok) {
    return {
      ok: false,
      message:
        parsed.reason === "too_precise"
          ? "Use pounds and pence, with no more than two decimal places."
          : "Enter the price in pounds, such as 450 or 450.00.",
    };
  }
  if (parsed.pence <= 0) return { ok: false, message: "The price must be more than £0." };
  if (parsed.pence > ARTWORK_EDITION_PRICE_MAX_PENCE) {
    return { ok: false, message: `The price can be up to ${MAX_PRICE_LABEL}.` };
  }
  return { ok: true, pence: parsed.pence };
}

function tooLong(value: string, max: number, what: string): string | null {
  return value.trim().length > max ? `${what} must be ${max} characters or fewer.` : null;
}

/**
 * Every problem with the form, keyed by field, each message readable on its own (the summary
 * lists them without labels). Mirrors the API's rules so staff hear about them before saving.
 */
export function validateArtworkForm(
  values: ArtworkFormValues,
  context: ArtworkFormContext,
): Partial<Record<ArtworkFormField, string>> {
  const errors: Partial<Record<ArtworkFormField, string>> = {};
  const title = values.title.trim();
  if (!title) errors.title = "Enter the artwork's title.";
  else {
    const long = tooLong(title, ARTWORK_TITLE_MAX_LENGTH, "The title");
    if (long) errors.title = long;
  }

  if (context.mode === "create") {
    const slug = values.slug.trim();
    if (!slug) errors.slug = "Enter the web address slug.";
    else if (slug.length > CATALOGUE_SLUG_MAX_LENGTH) {
      errors.slug = `The slug must be ${CATALOGUE_SLUG_MAX_LENGTH} characters or fewer.`;
    } else if (!SLUG_PATTERN.test(slug)) {
      errors.slug = "Use lower case letters, numbers and single hyphens, such as harbour-at-dusk.";
    }
  }

  if (!values.artistId) errors.artistId = "Choose the artist.";

  const year = values.yearCreated.trim();
  if (year) {
    const value = Number(year);
    const latest = context.currentYear + 1;
    if (!/^\d{4}$/.test(year) || value < ARTWORK_YEAR_MIN || value > latest) {
      errors.yearCreated = `Enter a four-digit year up to ${latest}, or leave it blank.`;
    }
  }

  const medium = tooLong(values.medium, ARTWORK_MEDIUM_MAX_LENGTH, "The medium");
  if (medium) errors.medium = medium;
  const dimensions = tooLong(values.dimensions, ARTWORK_DIMENSIONS_MAX_LENGTH, "The dimensions");
  if (dimensions) errors.dimensions = dimensions;
  const description = tooLong(
    values.description,
    ARTWORK_DESCRIPTION_MAX_LENGTH,
    "The description",
  );
  if (description) errors.description = description;

  if (values.editionRun === "editions" && context.canSetPrice) {
    const price = parseArtworkPrice(values.priceText);
    if (!price.ok) errors.price = price.message;
    else if (price.pence === null && context.live && values.saleState === "for_sale") {
      errors.price =
        "A live edition on sale needs a price. Unpublish it first to remove the price.";
    }
  }

  if (values.images.length > ARTWORK_IMAGES_MAX) {
    errors.images = `Keep to ${ARTWORK_IMAGES_MAX} images or fewer.`;
  } else if (
    values.images.some((image) => image.alt.trim().length > ARTWORK_IMAGE_ALT_MAX_LENGTH)
  ) {
    errors.images = `Image descriptions must be ${ARTWORK_IMAGE_ALT_MAX_LENGTH} characters or fewer.`;
  }

  const seoTitle = tooLong(values.seoTitle, SEO_TITLE_MAX_LENGTH, "The search title");
  if (seoTitle) errors.seoTitle = seoTitle;
  const seoDescription = tooLong(
    values.seoDescription,
    SEO_DESCRIPTION_MAX_LENGTH,
    "The search description",
  );
  if (seoDescription) errors.seoDescription = seoDescription;
  return errors;
}

/** The errors in page order, linked to their fields, for `FormErrorSummary`. */
export function artworkErrorSummary(
  errors: Partial<Record<ArtworkFormField, string>>,
): Array<{ fieldId: string; message: string }> {
  return ARTWORK_FORM_FIELDS.flatMap((field) => {
    const message = errors[field];
    return message ? [{ fieldId: artworkFieldId(field), message }] : [];
  });
}

const text = (value: string) => value.trim() || null;

type EditablePayload = Omit<AdminArtworkUpdateBody, "expectedVersion">;

/**
 * The fields both create and save send. An original never carries a price, and staff without
 * price access send the price they were shown, so their save never changes it.
 */
function editablePayload(
  values: ArtworkFormValues,
  context: Pick<ArtworkFormContext, "canSetPrice">,
  storedPricePence: number | null,
): EditablePayload {
  const parsed = parseArtworkPrice(values.priceText);
  const pricePence =
    values.editionRun === "original"
      ? null
      : context.canSetPrice
        ? parsed.ok
          ? parsed.pence
          : null
        : storedPricePence;
  return {
    title: values.title.trim(),
    artistId: values.artistId ?? "",
    yearCreated: values.yearCreated.trim() ? Number(values.yearCreated.trim()) : null,
    medium: text(values.medium),
    dimensions: text(values.dimensions),
    description: text(values.description),
    ...(pricePence === null ? {} : { printPricePence: pricePence }),
    saleState: values.saleState,
    salesChannel: values.salesChannel,
    // Only an edition links to an original; an original always sends no link.
    sourceOriginalArtworkId: values.editionRun === "editions" ? values.sourceOriginalId : null,
    images: values.images.map((image) => ({ mediaKey: image.mediaKey, alt: text(image.alt) })),
    seoTitle: text(values.seoTitle),
    seoDescription: text(values.seoDescription),
  };
}

/** The new artwork with its run of prints (from the create steps), or none for an original. */
export function buildArtworkCreateBody(
  values: ArtworkFormValues,
  context: Pick<ArtworkFormContext, "canSetPrice">,
  run: AdminNewRunInput | null,
): AdminArtworkCreateBody {
  return {
    ...editablePayload(values, context, null),
    slug: values.slug.trim(),
    run: values.editionRun === "editions" ? run : null,
  };
}

/** A new artwork's kind: prints sell on LAX Shop and originals on lax.art, unless staff change it. */
export function withArtworkKind(
  values: ArtworkFormValues,
  editionRun: ArtworkFormValues["editionRun"],
): ArtworkFormValues {
  return {
    ...values,
    editionRun,
    salesChannel: editionRun === "editions" ? "shop" : "art",
    saleState:
      editionRun === "original" && values.saleState === "for_sale"
        ? "price_on_application"
        : editionRun === "editions" && values.saleState === "price_on_application"
          ? "for_sale"
          : values.saleState,
  };
}

export function buildArtworkUpdateBody(
  values: ArtworkFormValues,
  context: Pick<ArtworkFormContext, "canSetPrice">,
  storedPricePence: number | null,
): EditablePayload {
  return editablePayload(values, context, storedPricePence);
}

/** What a save would change, compared field by field after trimming, so stray spaces are not edits. */
function comparable(values: ArtworkFormValues) {
  return JSON.stringify({
    title: values.title.trim(),
    slug: values.slug.trim(),
    artistId: values.artistId,
    yearCreated: values.yearCreated.trim(),
    medium: values.medium.trim(),
    dimensions: values.dimensions.trim(),
    description: values.description.trim(),
    editionRun: values.editionRun,
    price: parseArtworkPrice(values.priceText),
    saleState: values.saleState,
    salesChannel: values.salesChannel,
    sourceOriginalId: values.sourceOriginalId,
    images: values.images.map((image) => [image.mediaKey, image.alt.trim()]),
    seoTitle: values.seoTitle.trim(),
    seoDescription: values.seoDescription.trim(),
  });
}

export function isArtworkFormDirty(
  values: ArtworkFormValues,
  baseline: ArtworkFormValues,
): boolean {
  return comparable(values) !== comparable(baseline);
}

/** A 409 for a taken slug belongs on the slug field; anything else is shown above the form. */
export function artworkConflictField(message: string): ArtworkFormField | null {
  return message === ARTWORK_SLUG_IN_USE_MESSAGE ? "slug" : null;
}

export function moveImage(
  images: readonly ArtworkFormImage[],
  index: number,
  offset: -1 | 1,
): ArtworkFormImage[] {
  const target = index + offset;
  if (index < 0 || index >= images.length || target < 0 || target >= images.length) {
    return [...images];
  }
  const next = [...images];
  const [moved] = next.splice(index, 1);
  if (moved) next.splice(target, 0, moved);
  return next;
}

/** The first image is the primary one: it leads the gallery and is the list thumbnail. */
export function makePrimaryImage(
  images: readonly ArtworkFormImage[],
  index: number,
): ArtworkFormImage[] {
  const chosen = images[index];
  if (!chosen || index === 0) return [...images];
  return [chosen, ...images.filter((_, position) => position !== index)];
}

export function removeImage(
  images: readonly ArtworkFormImage[],
  index: number,
): ArtworkFormImage[] {
  return images.filter((_, position) => position !== index);
}

/** Adds uploaded images at the end, skipping any already in the gallery. */
export function appendImages(
  images: readonly ArtworkFormImage[],
  added: readonly ArtworkFormImage[],
): ArtworkFormImage[] {
  const known = new Set(images.map((image) => image.mediaKey));
  return [...images, ...added.filter((image) => !known.has(image.mediaKey))];
}

export type { FieldErrors };
