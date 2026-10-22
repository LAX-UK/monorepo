import {
  type EditorialBlock,
  EditorialExhibitionWriteBodySchema,
  EditorialPageWriteBodySchema,
  type EditorialStoryCategory,
  type EditorialStoryKind,
  EditorialStoryWriteBodySchema,
  EditorialVenueWriteBodySchema,
} from "@auction/shop-contracts";
import type { TSchema } from "@sinclair/typebox";
import {
  type OpeningHoursForm,
  openingHoursFormFromStored,
  openingHoursToStored,
  weekProblems,
} from "./editorial-opening-hours";
import {
  type StoryKindField,
  formatDuration,
  parseDuration,
  storyKindHasField,
} from "./editorial-story-kinds";
import { editorialBlockErrors, isEditorialSlug, isHttpsUrl } from "./editorial-validation";
import { type FieldErrors, hasFieldErrors, parseWholeNumber } from "./form-validation";
import { schemaFieldErrors } from "./schema-field-errors";
import { SEO_FIELD_ERRORS, type SeoFieldsFormValues, seoFieldsFormValues } from "./seo-fields-form";

export type EditorialEntityKind = "pages" | "venues" | "exhibitions" | "stories";
export type EditorialPreviewEntity = "page" | "venue" | "exhibition" | "story";

export const EDITORIAL_PREVIEW_ENTITY: Record<EditorialEntityKind, EditorialPreviewEntity> = {
  pages: "page",
  venues: "venue",
  exhibitions: "exhibition",
  stories: "story",
};

export type EditorialPublicationStatus = "draft" | "published";

export type EditorialAdminRow = {
  id: string;
  slug: string;
  status: EditorialPublicationStatus;
  label: string;
  /** The row's `updatedAt`; sent back as `expectedVersion` so a stale save is refused. */
  updatedAt: string;
};

export const EXHIBITION_KINDS = ["exhibition", "film", "event"] as const;
export type ExhibitionKind = (typeof EXHIBITION_KINDS)[number];

type DetailBase = EditorialAdminRow & { body: unknown[] };
type SeoDetail = { seoTitle?: string | null; seoDescription?: string | null };
type SeoWrite = { seoTitle: string | null; seoDescription: string | null };

export type PageDetail = DetailBase & SeoDetail & { title: string };
export type VenueDetail = DetailBase & {
  name: string;
  address: string | null;
  postcode: string | null;
  streetLine: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  openingHours: unknown;
  phone: string | null;
  email: string | null;
  mapUrl: string | null;
  coverMediaKey: string | null;
};
export type StoryDetail = DetailBase &
  SeoDetail & {
    kind: EditorialStoryKind;
    category: EditorialStoryCategory | null;
    title: string;
    standfirst: string | null;
    coverMediaKey: string | null;
    videoUrl: string | null;
    featured: boolean;
    authorName: string | null;
    readMinutes: number | null;
    series: string | null;
    episodeNumber: number | null;
    audioUrl: string | null;
    durationSeconds: number | null;
    publicationName: string | null;
    externalUrl: string | null;
  };
export type ExhibitionDetail = DetailBase & {
  kind: ExhibitionKind;
  title: string;
  subtitle: string | null;
  summary: string | null;
  venueId: string | null;
  startsOn: string | null;
  endsOn: string | null;
  timesNote: string | null;
  coverMediaKey: string | null;
  featured: boolean;
  contactName: string | null;
  contactRole: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAvatarMediaKey: string | null;
};

export type PageForm = SeoFieldsFormValues & { slug: string; title: string };
export type VenueForm = {
  slug: string;
  name: string;
  address: string;
  postcode: string;
  streetLine: string;
  city: string;
  latitude: string;
  longitude: string;
  openingHours: OpeningHoursForm;
  phone: string;
  email: string;
  mapUrl: string;
  coverMediaKey: string | null;
};
export type StoryForm = SeoFieldsFormValues & {
  slug: string;
  kind: EditorialStoryKind;
  /** The kind as stored, so changing it clears fields the new kind does not use. Null when new. */
  savedKind: EditorialStoryKind | null;
  category: EditorialStoryCategory | "";
  title: string;
  standfirst: string;
  coverMediaKey: string | null;
  videoUrl: string;
  featured: boolean;
  authorName: string;
  readMinutes: string;
  series: string;
  episodeNumber: string;
  audioUrl: string;
  /** `mm:ss` or `h:mm:ss`. */
  duration: string;
  publicationName: string;
  externalUrl: string;
};
export type ExhibitionForm = {
  slug: string;
  kind: ExhibitionKind;
  title: string;
  subtitle: string;
  summary: string;
  venueId: string;
  startsOn: string;
  endsOn: string;
  timesNote: string;
  coverMediaKey: string | null;
  featured: boolean;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  contactPhone: string;
  contactAvatarMediaKey: string | null;
};

export type PageWriteBody = SeoWrite & { slug: string; title: string; body: EditorialBlock[] };
export type VenueWriteBody = {
  slug: string;
  name: string;
  address: string | null;
  postcode: string | null;
  streetLine: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  openingHours: unknown;
  phone: string | null;
  email: string | null;
  mapUrl: string | null;
  coverMediaKey: string | null;
  body: EditorialBlock[];
};
export type StoryWriteBody = SeoWrite & {
  slug: string;
  kind: EditorialStoryKind;
  category: EditorialStoryCategory | null;
  title: string;
  standfirst: string | null;
  coverMediaKey: string | null;
  videoUrl: string | null;
  featured: boolean;
  authorName: string | null;
  readMinutes: number | null;
  series: string | null;
  episodeNumber: number | null;
  audioUrl: string | null;
  durationSeconds: number | null;
  publicationName: string | null;
  externalUrl: string | null;
  body: EditorialBlock[];
};
export type ExhibitionWriteBody = {
  slug: string;
  kind: ExhibitionKind;
  title: string;
  subtitle: string | null;
  summary: string | null;
  venueId: string | null;
  startsOn: string | null;
  endsOn: string | null;
  timesNote: string | null;
  coverMediaKey: string | null;
  featured: boolean;
  contactName: string | null;
  contactRole: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAvatarMediaKey: string | null;
  body: EditorialBlock[];
};

export type PayloadResult<T> = { ok: true; payload: T } | { ok: false; errors: FieldErrors };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * What a field says when the shared write schema rejects it. Messages describe the rule, since
 * the schema only reports which field failed and a form field has to read on its own.
 */
const FIELD_MESSAGES: FieldErrors = {
  slug: "Slug must be lowercase letters and numbers separated by single hyphens (120 characters at most).",
  title: "Enter a title of up to 300 characters.",
  name: "Enter a name of up to 300 characters.",
  subtitle: "Subtitle must be 300 characters or fewer.",
  summary: "Summary must be 2,000 characters or fewer.",
  standfirst: "Standfirst must be 2,000 characters or fewer.",
  timesNote: "Times note must be 500 characters or fewer.",
  address: "Address must be 500 characters or fewer.",
  postcode: "Postcode must be 32 characters or fewer.",
  streetLine: "Street line must be 300 characters or fewer.",
  city: "City must be 120 characters or fewer.",
  phone: "Phone must be 64 characters or fewer.",
  email: "Email must be a valid address.",
  mapUrl: "Map URL must start with https://.",
  videoUrl: "Video URL must start with https://.",
  audioUrl: "Audio URL must start with https://.",
  externalUrl: "Link must start with https://.",
  authorName: "Author must be 300 characters or fewer.",
  publicationName: "Publication must be 300 characters or fewer.",
  series: "Series must be 120 characters or fewer.",
  contactName: "Contact name must be 200 characters or fewer.",
  contactRole: "Contact role must be 200 characters or fewer.",
  contactEmail: "Contact email must be a valid address.",
  contactPhone: "Contact phone must be 64 characters or fewer.",
  venueId: "Choose a venue from the list.",
  startsOn: "Start date must be a real date.",
  endsOn: "End date must be a real date.",
  body: "Some blocks cannot be saved. Check each block.",
  ...SEO_FIELD_ERRORS,
};

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

/** Parses an optional whole-number field; a bad value adds its message and reads as blank. */
function optionalWholeNumber(
  raw: string,
  bounds: { min: number; max: number },
  message: string,
  field: string,
  errors: FieldErrors,
): number | null {
  if (!raw.trim()) return null;
  const parsed = parseWholeNumber(raw, bounds, message);
  if (parsed.ok) return parsed.value;
  errors[field] = parsed.message;
  return null;
}

function optionalCoordinate(
  raw: string,
  limit: number,
  field: "latitude" | "longitude",
  errors: FieldErrors,
): number | null {
  if (!raw.trim()) return null;
  const value = Number(raw);
  if (Number.isNaN(value) || Math.abs(value) > limit) {
    errors[field] =
      `${field === "latitude" ? "Latitude" : "Longitude"} must be a number from -${limit} to ${limit}.`;
    return null;
  }
  return value;
}

/** Fields the form already rejected keep their own message; the schema only adds what is left. */
function finish<T extends object>(
  schema: TSchema,
  payload: T,
  blocks: readonly EditorialBlock[],
  errors: FieldErrors,
): PayloadResult<T> {
  const blockErrors = editorialBlockErrors(blocks);
  const { body: bodyError, ...schemaErrors } = schemaFieldErrors(schema, payload, FIELD_MESSAGES);
  // A block-level message says more than the schema's general complaint about the body.
  const generalBodyError = bodyError && !hasFieldErrors(blockErrors) ? { body: bodyError } : {};
  const all = { ...schemaErrors, ...generalBodyError, ...blockErrors, ...errors };
  return hasFieldErrors(all) ? { ok: false, errors: all } : { ok: true, payload };
}

function checkSlug(slug: string, errors: FieldErrors) {
  if (!slug) errors.slug = "Enter a slug.";
  else if (!isEditorialSlug(slug)) errors.slug = FIELD_MESSAGES.slug as string;
}

function checkRequired(value: string, field: string, message: string, errors: FieldErrors) {
  if (!value) errors[field] = message;
}

/** Blank SEO fields clear the override so the page falls back to generated metadata. */
function seoWrite(form: SeoFieldsFormValues): SeoWrite {
  return {
    seoTitle: form.seoTitle.trim() || null,
    seoDescription: form.seoDescription.trim() || null,
  };
}

function checkHttps(value: string | null, field: string, errors: FieldErrors) {
  if (value && !isHttpsUrl(value)) errors[field] = FIELD_MESSAGES[field] as string;
}

function checkEmail(value: string | null, field: string, errors: FieldErrors) {
  if (value && !EMAIL_PATTERN.test(value)) errors[field] = FIELD_MESSAGES[field] as string;
}

export function emptyPageForm(): PageForm {
  return { slug: "", title: "", ...seoFieldsFormValues(null) };
}

export function pageFormFromDetail(detail: PageDetail): PageForm {
  return { slug: detail.slug, title: detail.title, ...seoFieldsFormValues(detail) };
}

export function buildPagePayload(
  form: PageForm,
  blocks: EditorialBlock[],
): PayloadResult<PageWriteBody> {
  const errors: FieldErrors = {};
  const slug = form.slug.trim();
  const title = form.title.trim();
  checkSlug(slug, errors);
  checkRequired(title, "title", "Enter a title.", errors);
  const seo = seoWrite(form);
  return finish(
    EditorialPageWriteBodySchema,
    { slug, title, body: blocks, ...seo },
    blocks,
    errors,
  );
}

export function emptyVenueForm(): VenueForm {
  return {
    slug: "",
    name: "",
    address: "",
    postcode: "",
    streetLine: "",
    city: "",
    latitude: "",
    longitude: "",
    openingHours: openingHoursFormFromStored(null),
    phone: "",
    email: "",
    mapUrl: "",
    coverMediaKey: null,
  };
}

export function venueFormFromDetail(detail: VenueDetail): VenueForm {
  return {
    slug: detail.slug,
    name: detail.name,
    address: detail.address ?? "",
    postcode: detail.postcode ?? "",
    streetLine: detail.streetLine ?? "",
    city: detail.city ?? "",
    latitude: detail.latitude === null ? "" : String(detail.latitude),
    longitude: detail.longitude === null ? "" : String(detail.longitude),
    openingHours: openingHoursFormFromStored(detail.openingHours),
    phone: detail.phone ?? "",
    email: detail.email ?? "",
    mapUrl: detail.mapUrl ?? "",
    coverMediaKey: detail.coverMediaKey,
  };
}

export function buildVenuePayload(
  form: VenueForm,
  blocks: EditorialBlock[],
): PayloadResult<VenueWriteBody> {
  const errors: FieldErrors = {};
  const slug = form.slug.trim();
  const name = form.name.trim();
  checkSlug(slug, errors);
  checkRequired(name, "name", "Enter a name.", errors);
  const email = blankToNull(form.email);
  checkEmail(email, "email", errors);
  const mapUrl = blankToNull(form.mapUrl);
  checkHttps(mapUrl, "mapUrl", errors);
  const latitude = optionalCoordinate(form.latitude, 90, "latitude", errors);
  const longitude = optionalCoordinate(form.longitude, 180, "longitude", errors);
  if ((latitude === null) !== (longitude === null) && !errors.latitude && !errors.longitude) {
    errors[latitude === null ? "latitude" : "longitude"] =
      "Enter both latitude and longitude, or neither.";
  }
  if (form.openingHours.mode === "days") {
    const [first] = Object.values(weekProblems(form.openingHours.days));
    if (first) errors.openingHours = first;
  }
  return finish(
    EditorialVenueWriteBodySchema,
    {
      slug,
      name,
      address: blankToNull(form.address),
      postcode: blankToNull(form.postcode),
      streetLine: blankToNull(form.streetLine),
      city: blankToNull(form.city),
      latitude,
      longitude,
      openingHours: openingHoursToStored(form.openingHours),
      phone: blankToNull(form.phone),
      email,
      mapUrl,
      coverMediaKey: form.coverMediaKey,
      body: blocks,
    },
    blocks,
    errors,
  );
}

export function emptyStoryForm(): StoryForm {
  return {
    slug: "",
    kind: "article",
    savedKind: null,
    category: "",
    title: "",
    standfirst: "",
    coverMediaKey: null,
    videoUrl: "",
    featured: false,
    authorName: "",
    readMinutes: "",
    series: "",
    episodeNumber: "",
    audioUrl: "",
    duration: "",
    publicationName: "",
    externalUrl: "",
    ...seoFieldsFormValues(null),
  };
}

export function storyFormFromDetail(detail: StoryDetail): StoryForm {
  return {
    slug: detail.slug,
    kind: detail.kind,
    savedKind: detail.kind,
    category: detail.category ?? "",
    title: detail.title,
    standfirst: detail.standfirst ?? "",
    coverMediaKey: detail.coverMediaKey,
    videoUrl: detail.videoUrl ?? "",
    featured: detail.featured,
    authorName: detail.authorName ?? "",
    readMinutes: detail.readMinutes === null ? "" : String(detail.readMinutes),
    series: detail.series ?? "",
    episodeNumber: detail.episodeNumber === null ? "" : String(detail.episodeNumber),
    audioUrl: detail.audioUrl ?? "",
    duration: detail.durationSeconds === null ? "" : formatDuration(detail.durationSeconds),
    publicationName: detail.publicationName ?? "",
    externalUrl: detail.externalUrl ?? "",
    ...seoFieldsFormValues(detail),
  };
}

export function buildStoryPayload(
  form: StoryForm,
  blocks: EditorialBlock[],
): PayloadResult<StoryWriteBody> {
  const errors: FieldErrors = {};
  const slug = form.slug.trim();
  const title = form.title.trim();
  checkSlug(slug, errors);
  checkRequired(title, "title", "Enter a title.", errors);
  const videoUrl = blankToNull(form.videoUrl);
  checkHttps(videoUrl, "videoUrl", errors);

  // Changing the kind drops values the new kind does not use; an unchanged kind keeps whatever
  // is stored, so saving an older story never erases fields the form does not show for it.
  const kindChanged = form.savedKind !== form.kind;
  const uses = (field: StoryKindField) => !kindChanged || storyKindHasField(form.kind, field);
  const text = (field: StoryKindField & keyof StoryForm): string | null =>
    uses(field) ? blankToNull(form[field] as string) : null;

  const audioUrl = text("audioUrl");
  checkHttps(audioUrl, "audioUrl", errors);
  const externalUrl = text("externalUrl");
  checkHttps(externalUrl, "externalUrl", errors);

  const readMinutes = uses("readMinutes")
    ? optionalWholeNumber(
        form.readMinutes,
        { min: 1, max: 600 },
        "Reading time must be a whole number of minutes from 1 to 600.",
        "readMinutes",
        errors,
      )
    : null;
  const episodeNumber = uses("episodeNumber")
    ? optionalWholeNumber(
        form.episodeNumber,
        { min: 1, max: 100_000 },
        "Episode number must be a whole number from 1.",
        "episodeNumber",
        errors,
      )
    : null;
  let durationSeconds: number | null = null;
  if (uses("durationSeconds") && form.duration.trim()) {
    durationSeconds = parseDuration(form.duration);
    if (durationSeconds === null || durationSeconds < 1 || durationSeconds > 100_000) {
      errors.duration = "Enter the duration as mm:ss or h:mm:ss, for example 46:18.";
      durationSeconds = null;
    }
  }

  const seo = seoWrite(form);
  return finish(
    EditorialStoryWriteBodySchema,
    {
      slug,
      kind: form.kind,
      category: form.category === "" ? null : form.category,
      title,
      standfirst: blankToNull(form.standfirst),
      coverMediaKey: form.coverMediaKey,
      videoUrl,
      featured: form.featured,
      authorName: blankToNull(form.authorName),
      readMinutes,
      series: text("series"),
      episodeNumber,
      audioUrl,
      durationSeconds,
      publicationName: text("publicationName"),
      externalUrl,
      body: blocks,
      ...seo,
    },
    blocks,
    errors,
  );
}

export function emptyExhibitionForm(): ExhibitionForm {
  return {
    slug: "",
    kind: "exhibition",
    title: "",
    subtitle: "",
    summary: "",
    venueId: "",
    startsOn: "",
    endsOn: "",
    timesNote: "",
    coverMediaKey: null,
    featured: false,
    contactName: "",
    contactRole: "",
    contactEmail: "",
    contactPhone: "",
    contactAvatarMediaKey: null,
  };
}

export function exhibitionFormFromDetail(detail: ExhibitionDetail): ExhibitionForm {
  return {
    slug: detail.slug,
    kind: detail.kind,
    title: detail.title,
    subtitle: detail.subtitle ?? "",
    summary: detail.summary ?? "",
    venueId: detail.venueId ?? "",
    startsOn: detail.startsOn?.slice(0, 10) ?? "",
    endsOn: detail.endsOn?.slice(0, 10) ?? "",
    timesNote: detail.timesNote ?? "",
    coverMediaKey: detail.coverMediaKey,
    featured: detail.featured,
    contactName: detail.contactName ?? "",
    contactRole: detail.contactRole ?? "",
    contactEmail: detail.contactEmail ?? "",
    contactPhone: detail.contactPhone ?? "",
    contactAvatarMediaKey: detail.contactAvatarMediaKey,
  };
}

export function buildExhibitionPayload(
  form: ExhibitionForm,
  blocks: EditorialBlock[],
): PayloadResult<ExhibitionWriteBody> {
  const errors: FieldErrors = {};
  const slug = form.slug.trim();
  const title = form.title.trim();
  checkSlug(slug, errors);
  checkRequired(title, "title", "Enter a title.", errors);
  const venueId = blankToNull(form.venueId);
  if (venueId && !isUuid(venueId)) errors.venueId = FIELD_MESSAGES.venueId as string;
  const startsOn = blankToNull(form.startsOn);
  const endsOn = blankToNull(form.endsOn);
  if (startsOn && !isIsoDate(startsOn)) errors.startsOn = "Start date must be YYYY-MM-DD.";
  if (endsOn && !isIsoDate(endsOn)) errors.endsOn = "End date must be YYYY-MM-DD.";
  if (startsOn && endsOn && !errors.startsOn && !errors.endsOn && endsOn < startsOn) {
    errors.endsOn = "End date cannot be before the start date.";
  }
  const contactEmail = blankToNull(form.contactEmail);
  checkEmail(contactEmail, "contactEmail", errors);
  return finish(
    EditorialExhibitionWriteBodySchema,
    {
      slug,
      kind: form.kind,
      title,
      subtitle: blankToNull(form.subtitle),
      summary: blankToNull(form.summary),
      venueId,
      startsOn,
      endsOn,
      timesNote: blankToNull(form.timesNote),
      coverMediaKey: form.coverMediaKey,
      featured: form.featured,
      contactName: blankToNull(form.contactName),
      contactRole: blankToNull(form.contactRole),
      contactEmail,
      contactPhone: blankToNull(form.contactPhone),
      contactAvatarMediaKey: form.contactAvatarMediaKey,
      body: blocks,
    },
    blocks,
    errors,
  );
}
