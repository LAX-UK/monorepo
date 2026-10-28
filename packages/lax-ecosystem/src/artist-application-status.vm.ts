/**
 * An artist application's status as the artist reads it, the same on lax.art and in LAX Account:
 * a short label for a badge, a tone, and a sentence on what happens next. Statuses come from the
 * shop API (`ArtistApplicationStatusValue`); a value nobody mapped reads as a calm "Submitted".
 */
export type ArtistApplicationApplicantStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "more_info_needed"
  | "accepted"
  | "declined";

/** Info while the gallery works, attention when the artist has something to do, done at the end. */
export type ArtistApplicationStatusTone = "neutral" | "info" | "attention" | "success";

export type ArtistApplicationStatusVm = {
  label: string;
  tone: ArtistApplicationStatusTone;
  /** What happens next, in a sentence. */
  next: string;
};

const STATUS: Record<ArtistApplicationApplicantStatus, ArtistApplicationStatusVm> = {
  draft: {
    label: "Draft",
    tone: "neutral",
    next: "Your application is saved. Finish it and send it when you are ready.",
  },
  submitted: {
    label: "Submitted",
    tone: "info",
    next: "The gallery team has your application and will review it. We reply by email.",
  },
  in_review: {
    label: "In review",
    tone: "info",
    next: "A member of the gallery team is looking at your work. We reply by email.",
  },
  more_info_needed: {
    label: "More information needed",
    tone: "attention",
    next: "The gallery has a question. Answer it in your application and send it back.",
  },
  accepted: {
    label: "Accepted",
    tone: "success",
    next: "Welcome to the gallery. Your artist portal is open.",
  },
  declined: {
    label: "Declined",
    tone: "neutral",
    next: "Thank you for applying. You are welcome to apply again with new work.",
  },
};

function isApplicantStatus(status: string): status is ArtistApplicationApplicantStatus {
  return Object.hasOwn(STATUS, status);
}

export function presentArtistApplicationStatus(status: string): ArtistApplicationStatusVm {
  return isApplicantStatus(status) ? STATUS[status] : STATUS.submitted;
}

/** The order the artist sees an application move through, for a progress line. */
export const ARTIST_APPLICATION_JOURNEY = [
  { id: "submitted", label: "Submitted" },
  { id: "in_review", label: "In review" },
  { id: "decided", label: "Decision" },
] as const;

/** How far along the journey an application is: 0 submitted, 1 in review, 2 decided. */
export function artistApplicationJourneyStep(status: string): number {
  if (status === "accepted" || status === "declined") return 2;
  if (status === "in_review" || status === "more_info_needed") return 1;
  return 0;
}
