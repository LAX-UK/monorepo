import type { MyArtistApplication, SaveArtistApplicationBody } from "@auction/shop-contracts";
import {
  ARTIST_APPLICATION_LIMITS,
  type ArtistApplicationContent,
  type ArtistApplicationStep,
  type ArtistApplicationWorkKind,
  artistApplicationSubmitBlockers,
  normaliseArtistApplicationUrl,
} from "@auction/shop-domain";

/*
 * The application form's state and its rules, without React: the steps, what each field holds as
 * typed text, how a saved application fills the form, what the API is sent, and which errors stop
 * a step. The missing-answer rules are the domain's, so the form and the API never disagree.
 */

export type ArtistApplicationStepMeta = {
  id: ArtistApplicationStep;
  label: string;
  title: string;
  intro: string;
};

export const ARTIST_APPLICATION_FORM_STEPS: readonly ArtistApplicationStepMeta[] = [
  {
    id: "about",
    label: "About you",
    title: "About you",
    intro: "Tell us who you are and where we can see more of your work.",
  },
  {
    id: "work",
    label: "Your work",
    title: "Your work",
    intro: `Add ${ARTIST_APPLICATION_LIMITS.minWorks} to ${ARTIST_APPLICATION_LIMITS.maxWorks} works that show your practice today, with a few facts about each.`,
  },
  {
    id: "statement",
    label: "Statement",
    title: "Your statement",
    intro: "In your own words: what you make, and why.",
  },
  {
    id: "agreement",
    label: "Agreement",
    title: "Check and send",
    intro: "Look over your answers, then send your application to the gallery team.",
  },
];

export type ArtistApplicationWorkDraft = {
  mediaKey: string;
  imageUrl: string | null;
  width: number | null;
  height: number | null;
  title: string;
  /** As typed, so a half-written year never jumps. */
  year: string;
  medium: string;
  size: string;
  kind: ArtistApplicationWorkKind | "";
};

export type ArtistApplicationFormState = {
  artistName: string;
  location: string;
  website: string;
  /** One box per link, always with room for one more up to the limit. */
  socialLinks: string[];
  shortBio: string;
  statement: string;
  representation: string;
  exhibitions: string;
  consentToContact: boolean;
  works: ArtistApplicationWorkDraft[];
};

export const EMPTY_ARTIST_APPLICATION_FORM: ArtistApplicationFormState = {
  artistName: "",
  location: "",
  website: "",
  socialLinks: [""],
  shortBio: "",
  statement: "",
  representation: "",
  exhibitions: "",
  consentToContact: false,
  works: [],
};

/** The DOM id of a field, so the error summary can link to it. */
export function applicationFieldId(field: string): string {
  return `application-${field.replace(/\./g, "-")}`;
}

/**
 * Keeps exactly one empty box after the last link, until the limit is reached. Boxes the artist
 * empties in the middle stay where they are, so the one being typed in never moves.
 */
export function withSpareLink(links: readonly string[]): string[] {
  const next = links.slice(0, ARTIST_APPLICATION_LIMITS.maxSocialLinks);
  const blank = (index: number) => !next[index]?.trim();
  while (next.length > 1 && blank(next.length - 1) && blank(next.length - 2)) next.pop();
  if (next.length === 0) return [""];
  if (!blank(next.length - 1) && next.length < ARTIST_APPLICATION_LIMITS.maxSocialLinks) {
    next.push("");
  }
  return next;
}

export function formFromApplication(application: MyArtistApplication): ArtistApplicationFormState {
  return {
    artistName: application.artistName ?? "",
    location: application.location ?? "",
    website: application.website ?? "",
    socialLinks: withSpareLink(application.socialLinks.filter((link) => link.trim())),
    shortBio: application.shortBio ?? "",
    statement: application.statement ?? "",
    representation: application.representation ?? "",
    exhibitions: application.exhibitions ?? "",
    consentToContact: application.consentToContact,
    works: application.works.map((work) => ({
      mediaKey: work.mediaKey,
      imageUrl: work.imageUrl,
      width: work.width,
      height: work.height,
      title: work.title ?? "",
      year: work.year?.toString() ?? "",
      medium: work.medium ?? "",
      size: work.size ?? "",
      kind: work.kind ?? "",
    })),
  };
}

/** Keeps the works the server now holds (a new upload, a removal) and the answers being typed. */
export function mergeServerWorks(
  form: ArtistApplicationFormState,
  application: MyArtistApplication,
): ArtistApplicationFormState {
  const typed = new Map(form.works.map((work) => [work.mediaKey, work]));
  return {
    ...form,
    works: formFromApplication(application).works.map((work) => typed.get(work.mediaKey) ?? work),
  };
}

const blankToNull = (value: string) => (value.trim() ? value.trim() : null);

function parseYear(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{1,4}$/.test(trimmed)) return null;
  return Number(trimmed);
}

export function contentFromForm(form: ArtistApplicationFormState): ArtistApplicationContent {
  return {
    artistName: blankToNull(form.artistName),
    location: blankToNull(form.location),
    website: blankToNull(form.website),
    socialLinks: form.socialLinks.map((link) => link.trim()).filter(Boolean),
    shortBio: blankToNull(form.shortBio),
    statement: blankToNull(form.statement),
    representation: blankToNull(form.representation),
    exhibitions: blankToNull(form.exhibitions),
    consentToContact: form.consentToContact,
    works: form.works.map((work) => ({
      mediaKey: work.mediaKey,
      title: blankToNull(work.title),
      year: parseYear(work.year),
      medium: blankToNull(work.medium),
      size: blankToNull(work.size),
      kind: work.kind || null,
    })),
  };
}

export function saveBodyFromForm(
  form: ArtistApplicationFormState,
  expectedVersion: number,
): SaveArtistApplicationBody {
  const content = contentFromForm(form);
  return {
    expectedVersion,
    ...content,
    socialLinks: [...content.socialLinks],
    works: [...content.works],
  };
}

export type ArtistApplicationFieldErrors = Record<string, string>;

/** Checks a draft may hold whatever is missing, but a web address must be one. */
function formatErrors(
  form: ArtistApplicationFormState,
  step: ArtistApplicationStep,
): ArtistApplicationFieldErrors {
  const errors: ArtistApplicationFieldErrors = {};
  if (step === "about") {
    if (form.website.trim() && !normaliseArtistApplicationUrl(form.website)) {
      errors.website = "Enter your website as a web address, like studio.example.com.";
    }
    form.socialLinks.forEach((link, index) => {
      if (link.trim() && !normaliseArtistApplicationUrl(link)) {
        errors[`socialLinks.${index}`] =
          "Enter the link as a web address, like instagram.com/yourname.";
      }
    });
  }
  if (step === "work") {
    form.works.forEach((work, index) => {
      if (work.year.trim() && parseYear(work.year) === null) {
        errors[`works.${index}.year`] = `Enter the year work ${index + 1} was made, like 2024.`;
      }
    });
  }
  return errors;
}

/**
 * What stops a step: the domain's missing answers for that step, then format problems. The
 * errors are keyed by field, in the order the fields appear, for the summary and each field.
 */
export function stepErrors(
  form: ArtistApplicationFormState,
  step: ArtistApplicationStep,
  now: Date,
): ArtistApplicationFieldErrors {
  const errors: ArtistApplicationFieldErrors = {};
  for (const blocker of artistApplicationSubmitBlockers(contentFromForm(form), now)) {
    if (blocker.step === step && !(blocker.field in errors))
      errors[blocker.field] = blocker.message;
  }
  return { ...errors, ...formatErrors(form, step) };
}

/** Steps with nothing missing, for the progress line's ticks. */
export function completedSteps(
  form: ArtistApplicationFormState,
  now: Date,
): ArtistApplicationStep[] {
  return ARTIST_APPLICATION_FORM_STEPS.map((step) => step.id).filter(
    (step) => Object.keys(stepErrors(form, step, now)).length === 0,
  );
}
