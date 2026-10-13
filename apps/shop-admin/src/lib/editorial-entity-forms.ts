import type { EditorialBlock } from "@auction/shop-contracts";
import { isEditorialSlug, isHttpsUrl, validateEditorialBlocks } from "./editorial-validation";

export type EditorialEntityKind = "pages" | "venues" | "exhibitions" | "stories";
export type EditorialPreviewEntity = "page" | "venue" | "exhibition" | "story";

export const EDITORIAL_PREVIEW_ENTITY: Record<EditorialEntityKind, EditorialPreviewEntity> = {
  pages: "page",
  venues: "venue",
  exhibitions: "exhibition",
  stories: "story",
};

export type EditorialAdminRow = {
  id: string;
  slug: string;
  status: "draft" | "published";
  label: string;
};

export const STORY_KINDS = ["article", "film", "press", "guide"] as const;
export type StoryKind = (typeof STORY_KINDS)[number];
export const EXHIBITION_KINDS = ["exhibition", "film", "event"] as const;
export type ExhibitionKind = (typeof EXHIBITION_KINDS)[number];

type DetailBase = EditorialAdminRow & { body: unknown[] };

export type PageDetail = DetailBase & { title: string };
export type VenueDetail = DetailBase & {
  name: string;
  address: string | null;
  postcode: string | null;
  openingHours: unknown;
  phone: string | null;
  email: string | null;
  mapUrl: string | null;
  coverMediaKey: string | null;
};
export type StoryDetail = DetailBase & {
  kind: StoryKind;
  title: string;
  standfirst: string | null;
  coverMediaKey: string | null;
  videoUrl: string | null;
  featured: boolean;
};
export type ExhibitionDetail = DetailBase & {
  kind: ExhibitionKind;
  title: string;
  summary: string | null;
  venueId: string | null;
  startsOn: string | null;
  endsOn: string | null;
  timesNote: string | null;
  coverMediaKey: string | null;
  featured: boolean;
};

export type PageForm = { slug: string; title: string };
export type VenueForm = {
  slug: string;
  name: string;
  address: string;
  postcode: string;
  openingHoursJson: string;
  phone: string;
  email: string;
  mapUrl: string;
  coverMediaKey: string | null;
};
export type StoryForm = {
  slug: string;
  kind: StoryKind;
  title: string;
  standfirst: string;
  coverMediaKey: string | null;
  videoUrl: string;
  featured: boolean;
};
export type ExhibitionForm = {
  slug: string;
  kind: ExhibitionKind;
  title: string;
  summary: string;
  venueId: string;
  startsOn: string;
  endsOn: string;
  timesNote: string;
  coverMediaKey: string | null;
  featured: boolean;
};

export type PageWriteBody = { slug: string; title: string; body: EditorialBlock[] };
export type VenueWriteBody = {
  slug: string;
  name: string;
  address: string | null;
  postcode: string | null;
  openingHours: unknown;
  phone: string | null;
  email: string | null;
  mapUrl: string | null;
  coverMediaKey: string | null;
  body: EditorialBlock[];
};
export type StoryWriteBody = {
  slug: string;
  kind: StoryKind;
  title: string;
  standfirst: string | null;
  coverMediaKey: string | null;
  videoUrl: string | null;
  featured: boolean;
  body: EditorialBlock[];
};
export type ExhibitionWriteBody = {
  slug: string;
  kind: ExhibitionKind;
  title: string;
  summary: string | null;
  venueId: string | null;
  startsOn: string | null;
  endsOn: string | null;
  timesNote: string | null;
  coverMediaKey: string | null;
  featured: boolean;
  body: EditorialBlock[];
};

export type PayloadResult<T> = { ok: true; payload: T } | { ok: false; errors: string[] };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function checkSlug(slug: string, errors: string[]) {
  if (!slug) errors.push("Slug is required.");
  else if (!isEditorialSlug(slug)) {
    errors.push("Slug must be lowercase letters and numbers separated by single hyphens.");
  }
}

function checkRequired(value: string, label: string, errors: string[]) {
  if (!value) errors.push(`${label} is required.`);
}

function finish<T>(
  errors: string[],
  blocks: readonly EditorialBlock[],
  payload: T,
): PayloadResult<T> {
  const all = [...errors, ...validateEditorialBlocks(blocks)];
  return all.length > 0 ? { ok: false, errors: all } : { ok: true, payload };
}

export function emptyPageForm(): PageForm {
  return { slug: "", title: "" };
}

export function pageFormFromDetail(detail: PageDetail): PageForm {
  return { slug: detail.slug, title: detail.title };
}

export function buildPagePayload(
  form: PageForm,
  blocks: EditorialBlock[],
): PayloadResult<PageWriteBody> {
  const errors: string[] = [];
  const slug = form.slug.trim();
  const title = form.title.trim();
  checkSlug(slug, errors);
  checkRequired(title, "Title", errors);
  return finish(errors, blocks, { slug, title, body: blocks });
}

export function emptyVenueForm(): VenueForm {
  return {
    slug: "",
    name: "",
    address: "",
    postcode: "",
    openingHoursJson: "",
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
    openingHoursJson:
      detail.openingHours === null || detail.openingHours === undefined
        ? ""
        : JSON.stringify(detail.openingHours, null, 2),
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
  const errors: string[] = [];
  const slug = form.slug.trim();
  const name = form.name.trim();
  checkSlug(slug, errors);
  checkRequired(name, "Name", errors);
  const email = blankToNull(form.email);
  if (email && !EMAIL_PATTERN.test(email)) errors.push("Email must be a valid address.");
  const mapUrl = blankToNull(form.mapUrl);
  if (mapUrl && !isHttpsUrl(mapUrl)) errors.push("Map URL must start with https://.");
  let openingHours: unknown = null;
  if (form.openingHoursJson.trim()) {
    try {
      openingHours = JSON.parse(form.openingHoursJson);
    } catch {
      errors.push("Opening hours must be valid JSON (or left blank).");
    }
  }
  return finish(errors, blocks, {
    slug,
    name,
    address: blankToNull(form.address),
    postcode: blankToNull(form.postcode),
    openingHours,
    phone: blankToNull(form.phone),
    email,
    mapUrl,
    coverMediaKey: form.coverMediaKey,
    body: blocks,
  });
}

export function emptyStoryForm(): StoryForm {
  return {
    slug: "",
    kind: "article",
    title: "",
    standfirst: "",
    coverMediaKey: null,
    videoUrl: "",
    featured: false,
  };
}

export function storyFormFromDetail(detail: StoryDetail): StoryForm {
  return {
    slug: detail.slug,
    kind: detail.kind,
    title: detail.title,
    standfirst: detail.standfirst ?? "",
    coverMediaKey: detail.coverMediaKey,
    videoUrl: detail.videoUrl ?? "",
    featured: detail.featured,
  };
}

export function buildStoryPayload(
  form: StoryForm,
  blocks: EditorialBlock[],
): PayloadResult<StoryWriteBody> {
  const errors: string[] = [];
  const slug = form.slug.trim();
  const title = form.title.trim();
  checkSlug(slug, errors);
  checkRequired(title, "Title", errors);
  const videoUrl = blankToNull(form.videoUrl);
  if (videoUrl && !isHttpsUrl(videoUrl)) errors.push("Video URL must start with https://.");
  return finish(errors, blocks, {
    slug,
    kind: form.kind,
    title,
    standfirst: blankToNull(form.standfirst),
    coverMediaKey: form.coverMediaKey,
    videoUrl,
    featured: form.featured,
    body: blocks,
  });
}

export function emptyExhibitionForm(): ExhibitionForm {
  return {
    slug: "",
    kind: "exhibition",
    title: "",
    summary: "",
    venueId: "",
    startsOn: "",
    endsOn: "",
    timesNote: "",
    coverMediaKey: null,
    featured: false,
  };
}

export function exhibitionFormFromDetail(detail: ExhibitionDetail): ExhibitionForm {
  return {
    slug: detail.slug,
    kind: detail.kind,
    title: detail.title,
    summary: detail.summary ?? "",
    venueId: detail.venueId ?? "",
    startsOn: detail.startsOn?.slice(0, 10) ?? "",
    endsOn: detail.endsOn?.slice(0, 10) ?? "",
    timesNote: detail.timesNote ?? "",
    coverMediaKey: detail.coverMediaKey,
    featured: detail.featured,
  };
}

export function buildExhibitionPayload(
  form: ExhibitionForm,
  blocks: EditorialBlock[],
): PayloadResult<ExhibitionWriteBody> {
  const errors: string[] = [];
  const slug = form.slug.trim();
  const title = form.title.trim();
  checkSlug(slug, errors);
  checkRequired(title, "Title", errors);
  const venueId = blankToNull(form.venueId);
  if (venueId && !isUuid(venueId)) errors.push("Choose a venue from the list.");
  const startsOn = blankToNull(form.startsOn);
  const endsOn = blankToNull(form.endsOn);
  if (startsOn && !isIsoDate(startsOn)) errors.push("Start date must be YYYY-MM-DD.");
  if (endsOn && !isIsoDate(endsOn)) errors.push("End date must be YYYY-MM-DD.");
  if (startsOn && endsOn && isIsoDate(startsOn) && isIsoDate(endsOn) && endsOn < startsOn) {
    errors.push("End date cannot be before the start date.");
  }
  return finish(errors, blocks, {
    slug,
    kind: form.kind,
    title,
    summary: blankToNull(form.summary),
    venueId,
    startsOn,
    endsOn,
    timesNote: blankToNull(form.timesNote),
    coverMediaKey: form.coverMediaKey,
    featured: form.featured,
    body: blocks,
  });
}
