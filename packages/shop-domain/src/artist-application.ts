import { ShopDomainError } from "./shop-domain-error.js";

/**
 * An artist's application to be represented by the gallery and join the artist portal.
 *
 * - `draft`: the applicant is still writing it; staff never see drafts.
 * - `submitted`: sent, waiting for a reviewer.
 * - `in_review`: a reviewer has picked it up.
 * - `more_info_needed`: the reviewer asked the artist something; the artist edits and sends it back.
 * - `accepted` and `declined` are final. A declined artist may apply again after a waiting period.
 */
export const ARTIST_APPLICATION_STATUSES = [
  "draft",
  "submitted",
  "in_review",
  "more_info_needed",
  "accepted",
  "declined",
] as const;

export type ArtistApplicationStatus = (typeof ARTIST_APPLICATION_STATUSES)[number];

export const ARTIST_APPLICATION_ACTIONS = [
  "submit",
  "resubmit",
  "assign",
  "request_info",
  "accept",
  "decline",
] as const;

export type ArtistApplicationAction = (typeof ARTIST_APPLICATION_ACTIONS)[number];

export type ArtistApplicationActor = "applicant" | "staff";

/** Who may take each action. Staff never submit for an artist, and an artist never decides. */
export const ARTIST_APPLICATION_ACTION_ACTOR: Readonly<
  Record<ArtistApplicationAction, ArtistApplicationActor>
> = {
  submit: "applicant",
  resubmit: "applicant",
  assign: "staff",
  request_info: "staff",
  accept: "staff",
  decline: "staff",
};

/**
 * The transition table: for each action, the statuses it may start from and where each one goes.
 * A status missing from an action's row means the action is refused there.
 *
 * - Assigning a reviewer to a new application starts the review; reassigning keeps the status.
 * - An answered request goes straight back to review, because a reviewer already holds it.
 * - Staff may decline while waiting on the artist (an artist who never answers), but they accept
 *   only an application whose answers they have seen.
 */
const TRANSITIONS: Readonly<
  Record<
    ArtistApplicationAction,
    Readonly<Partial<Record<ArtistApplicationStatus, ArtistApplicationStatus>>>
  >
> = {
  submit: { draft: "submitted" },
  resubmit: { more_info_needed: "in_review" },
  assign: {
    submitted: "in_review",
    in_review: "in_review",
    more_info_needed: "more_info_needed",
  },
  request_info: { submitted: "more_info_needed", in_review: "more_info_needed" },
  accept: { submitted: "accepted", in_review: "accepted" },
  decline: { submitted: "declined", in_review: "declined", more_info_needed: "declined" },
};

const REFUSED_MESSAGES: Readonly<Record<ArtistApplicationAction, string>> = {
  submit: "Only a draft application can be sent",
  resubmit: "Only an application waiting on the artist can be sent back",
  assign: "A decided application cannot be assigned",
  request_info: "Ask for more information only on an application under review",
  accept: "Only an application under review can be accepted",
  decline: "A decided application cannot be declined",
};

/** Where the action takes the application, or null when the action is refused in that status. */
export function nextArtistApplicationStatus(
  action: ArtistApplicationAction,
  from: ArtistApplicationStatus,
): ArtistApplicationStatus | null {
  return TRANSITIONS[action][from] ?? null;
}

/** The status after the action; throws `ShopDomainError` when the table refuses it. */
export function transitionArtistApplication(
  action: ArtistApplicationAction,
  from: ArtistApplicationStatus,
): ArtistApplicationStatus {
  const to = nextArtistApplicationStatus(action, from);
  if (to === null) throw new ShopDomainError(REFUSED_MESSAGES[action]);
  return to;
}

/** The actions this actor may take now, in the order a screen should offer them. */
export function availableArtistApplicationActions(
  status: ArtistApplicationStatus,
  actor: ArtistApplicationActor,
): ArtistApplicationAction[] {
  return ARTIST_APPLICATION_ACTIONS.filter(
    (action) =>
      ARTIST_APPLICATION_ACTION_ACTOR[action] === actor &&
      nextArtistApplicationStatus(action, status) !== null,
  );
}

/** The applicant may change the application only while writing it or answering a question. */
export function isArtistApplicationEditable(status: ArtistApplicationStatus): boolean {
  return status === "draft" || status === "more_info_needed";
}

/** Accepted and declined are final: nothing moves the application again. */
export function isArtistApplicationDecided(status: ArtistApplicationStatus): boolean {
  return status === "accepted" || status === "declined";
}

/** Staff-facing: sent and not yet decided. */
export function isArtistApplicationAwaitingDecision(status: ArtistApplicationStatus): boolean {
  return status !== "draft" && !isArtistApplicationDecided(status);
}

// ---------------------------------------------------------------------------------------------
// Applying again
// ---------------------------------------------------------------------------------------------

/** How long the gallery takes to answer an application, as every page and email promises it. */
export const ARTIST_APPLICATION_REVIEW_WEEKS = 4;

/** A declined artist may apply again this many months after the decision. */
export const ARTIST_APPLICATION_REAPPLY_MONTHS = 6;

export type ArtistApplicationStartDecision =
  /** No application, or a declined one whose waiting period is over: a new draft may start. */
  | { kind: "start" }
  /** An application is still open: continue it rather than start another. */
  | { kind: "continue"; applicationId: string }
  /** Declined recently: a new application may start on `availableFrom`. */
  | { kind: "wait"; availableFrom: Date }
  /** Already accepted: the artist uses the portal instead. */
  | { kind: "accepted" };

/** The date a declined artist may apply again: the same day of the month, six months on. */
export function artistApplicationReapplyDate(decidedAt: Date): Date {
  const next = new Date(decidedAt.getTime());
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + ARTIST_APPLICATION_REAPPLY_MONTHS);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

/** Decides whether the applicant may start a new application, from their latest one. */
export function decideArtistApplicationStart(
  latest: { id: string; status: ArtistApplicationStatus; decidedAt: Date | null } | null,
  now: Date,
): ArtistApplicationStartDecision {
  if (!latest) return { kind: "start" };
  if (latest.status === "accepted") return { kind: "accepted" };
  if (latest.status !== "declined") return { kind: "continue", applicationId: latest.id };
  const availableFrom = artistApplicationReapplyDate(latest.decidedAt ?? now);
  return now.getTime() >= availableFrom.getTime()
    ? { kind: "start" }
    : { kind: "wait", availableFrom };
}

// ---------------------------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------------------------

export const ARTIST_APPLICATION_WORK_KINDS = ["original", "edition"] as const;
export type ArtistApplicationWorkKind = (typeof ARTIST_APPLICATION_WORK_KINDS)[number];

/** Lengths and counts, shared by the form, the API and the database checks. */
export const ARTIST_APPLICATION_LIMITS = {
  minWorks: 6,
  maxWorks: 12,
  maxSocialLinks: 4,
  artistName: 120,
  location: 120,
  url: 300,
  shortBio: 1200,
  statement: 4000,
  representation: 1000,
  exhibitions: 2000,
  workTitle: 160,
  workMedium: 160,
  workSize: 80,
  /** Note from staff to the artist: a question or a reason for declining. */
  messageToArtist: 2000,
  earliestWorkYear: 1900,
} as const;

/** The form's steps, in order. Each blocker names the step that fixes it. */
export const ARTIST_APPLICATION_STEPS = ["about", "work", "statement", "agreement"] as const;
export type ArtistApplicationStep = (typeof ARTIST_APPLICATION_STEPS)[number];

export type ArtistApplicationWork = {
  mediaKey: string;
  title: string | null;
  year: number | null;
  medium: string | null;
  size: string | null;
  kind: ArtistApplicationWorkKind | null;
};

export type ArtistApplicationContent = {
  artistName: string | null;
  location: string | null;
  website: string | null;
  socialLinks: readonly string[];
  shortBio: string | null;
  statement: string | null;
  representation: string | null;
  exhibitions: string | null;
  works: readonly ArtistApplicationWork[];
  consentToContact: boolean;
};

export type ArtistApplicationBlocker = {
  step: ArtistApplicationStep;
  /** The field to focus: a content key, or `works.<index>.<field>` for one work. */
  field: string;
  message: string;
};

const blank = (value: string | null | undefined) => !value?.trim();

/**
 * Accepts a web address with or without its scheme ("studio.example" or "https://…") and returns
 * it with `https://`; null when it is not an http(s) address with a dotted host.
 */
export function normaliseArtistApplicationUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > ARTIST_APPLICATION_LIMITS.url) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!url.hostname.includes(".") || url.username || url.password) return null;
  return url.toString();
}

function workBlockers(
  work: ArtistApplicationWork,
  index: number,
  currentYear: number,
): ArtistApplicationBlocker[] {
  const n = index + 1;
  const at = (field: string, message: string): ArtistApplicationBlocker => ({
    step: "work",
    field: `works.${index}.${field}`,
    message,
  });
  const found: ArtistApplicationBlocker[] = [];
  if (blank(work.title)) found.push(at("title", `Enter a title for work ${n}.`));
  if (work.year === null) found.push(at("year", `Enter the year work ${n} was made.`));
  else if (work.year < ARTIST_APPLICATION_LIMITS.earliestWorkYear || work.year > currentYear) {
    found.push(
      at(
        "year",
        `Enter a year between ${ARTIST_APPLICATION_LIMITS.earliestWorkYear} and ${currentYear} for work ${n}.`,
      ),
    );
  }
  if (blank(work.medium)) found.push(at("medium", `Enter the medium of work ${n}.`));
  if (blank(work.size)) found.push(at("size", `Enter the size of work ${n}.`));
  if (work.kind === null)
    found.push(at("kind", `Say whether work ${n} is an original or an edition.`));
  return found;
}

/**
 * What still stops the application being sent, step by step, with the field to fix. Empty means
 * it can be sent. Drafts may be saved in any state; this is checked on submit only.
 */
export function artistApplicationSubmitBlockers(
  content: ArtistApplicationContent,
  now: Date,
): ArtistApplicationBlocker[] {
  const limits = ARTIST_APPLICATION_LIMITS;
  const found: ArtistApplicationBlocker[] = [];
  if (blank(content.artistName)) {
    found.push({ step: "about", field: "artistName", message: "Enter your name as an artist." });
  }
  if (blank(content.location)) {
    found.push({ step: "about", field: "location", message: "Enter where you live and work." });
  }
  if (blank(content.shortBio)) {
    found.push({ step: "about", field: "shortBio", message: "Write a short biography." });
  }
  const works = content.works;
  if (works.length < limits.minWorks) {
    const missing = limits.minWorks - works.length;
    found.push({
      step: "work",
      field: "works",
      message: `Add ${missing} more ${missing === 1 ? "work" : "works"}: we need at least ${limits.minWorks}.`,
    });
  }
  works.forEach((work, index) => {
    found.push(...workBlockers(work, index, now.getUTCFullYear()));
  });
  if (blank(content.statement)) {
    found.push({ step: "statement", field: "statement", message: "Write your artist statement." });
  }
  if (!content.consentToContact) {
    found.push({
      step: "agreement",
      field: "consentToContact",
      message: "Agree that the gallery may contact you about your application.",
    });
  }
  return found;
}

/**
 * Refuses content no draft may hold: over-long text, too many works or links, a link that is not
 * a web address, or the same image twice. Missing answers are fine in a draft.
 */
export function assertArtistApplicationContentWithinLimits(
  content: ArtistApplicationContent,
): void {
  const limits = ARTIST_APPLICATION_LIMITS;
  const tooLong = (value: string | null, max: number) => (value?.length ?? 0) > max;
  const checks: ReadonlyArray<readonly [boolean, string]> = [
    [tooLong(content.artistName, limits.artistName), "Your artist name is too long"],
    [tooLong(content.location, limits.location), "The location is too long"],
    [tooLong(content.shortBio, limits.shortBio), "The biography is too long"],
    [tooLong(content.statement, limits.statement), "The statement is too long"],
    [
      tooLong(content.representation, limits.representation),
      "The representation answer is too long",
    ],
    [tooLong(content.exhibitions, limits.exhibitions), "The exhibitions answer is too long"],
    [content.works.length > limits.maxWorks, `Add at most ${limits.maxWorks} works`],
    [
      content.socialLinks.length > limits.maxSocialLinks,
      `Add at most ${limits.maxSocialLinks} social links`,
    ],
    [
      content.website !== null && normaliseArtistApplicationUrl(content.website) === null,
      "Enter the website as a web address, like studio.example.com",
    ],
    [
      content.socialLinks.some((link) => normaliseArtistApplicationUrl(link) === null),
      "Enter each social link as a web address",
    ],
    [
      new Set(content.works.map((work) => work.mediaKey)).size !== content.works.length,
      "Each image can be added once",
    ],
    [
      content.works.some(
        (work) =>
          tooLong(work.title, limits.workTitle) ||
          tooLong(work.medium, limits.workMedium) ||
          tooLong(work.size, limits.workSize),
      ),
      "A work's title, medium or size is too long",
    ],
  ];
  const failed = checks.find(([broken]) => broken);
  if (failed) throw new ShopDomainError(failed[1]);
}

/** A note from staff to the artist must say something, and not too much. */
export function assertMessageToArtist(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) throw new ShopDomainError("Write a note to the artist");
  if (trimmed.length > ARTIST_APPLICATION_LIMITS.messageToArtist) {
    throw new ShopDomainError("Keep the note to the artist shorter");
  }
  return trimmed;
}
