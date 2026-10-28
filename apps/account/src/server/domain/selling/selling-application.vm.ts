import {
  ARTIST_APPLICATION_JOURNEY,
  type ArtistApplicationStatusTone,
  artistApplicationJourneyStep,
  presentArtistApplicationStatus,
} from "@auction/lax-ecosystem";
import type { MyArtistApplicationState } from "@auction/shop-contracts";
import { SELLING_ROUTES } from "./selling-routes";

/** Account's status badge tones, from the shared artist-facing tones. */
type BadgeTone = "success" | "info" | "warning" | "neutral";

const BADGE_TONE: Record<ArtistApplicationStatusTone, BadgeTone> = {
  neutral: "neutral",
  info: "info",
  attention: "warning",
  success: "success",
};

export type SellingApplicationAction = {
  label: string;
  href: string;
  emphasis: "primary" | "secondary";
};

export type SellingApplicationVm =
  | { kind: "none"; applyHref: string | null }
  | {
      kind: "application";
      reference: string;
      status: { label: string; tone: BadgeTone };
      next: string;
      /** "28 October 2026", or null for a draft. */
      sentOn: string | null;
      journey: ReadonlyArray<{ id: string; label: string; reached: boolean; current: boolean }>;
      /** The gallery's question or reason, with what to call it. */
      message: { label: string; text: string } | null;
      /** For a decline still in its waiting period: when a new application may start. */
      reapplyOn: string | null;
      action: SellingApplicationAction | null;
    };

const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/London",
});

const longDate = (value: string | null) => (value ? LONG_DATE.format(new Date(value)) : null);

/**
 * The Selling area's view of an artist application. Writing and answering happen on lax.art,
 * where the form is, so the action leads there; an accepted artist goes on to their artworks.
 */
export function buildSellingApplication(
  state: MyArtistApplicationState,
  artPublicUrl: string | undefined,
): SellingApplicationVm {
  const applyHref = artPublicUrl ? `${artPublicUrl}/for-artists/apply` : null;
  const application = state.application;
  if (!application) return { kind: "none", applyHref };

  const vm = presentArtistApplicationStatus(application.status);
  const step = artistApplicationJourneyStep(application.status);
  const toApply = (label: string, emphasis: SellingApplicationAction["emphasis"]) =>
    applyHref ? { label, href: applyHref, emphasis } : null;

  const action: SellingApplicationAction | null = (() => {
    switch (application.status) {
      case "draft":
        return toApply("Continue your application", "primary");
      case "more_info_needed":
        return toApply("Answer the question", "primary");
      case "accepted":
        return { label: "Your artworks", href: SELLING_ROUTES.artworks, emphasis: "primary" };
      case "declined":
        return state.next === "start" ? toApply("Start a new application", "primary") : null;
      default:
        return toApply("See it on lax.art", "secondary");
    }
  })();

  const message =
    application.messageToArtist && application.status === "more_info_needed"
      ? { label: "The gallery asked", text: application.messageToArtist }
      : application.messageToArtist && application.status === "declined"
        ? { label: "From the gallery", text: application.messageToArtist }
        : null;

  return {
    kind: "application",
    reference: application.reference,
    status: { label: vm.label, tone: BADGE_TONE[vm.tone] },
    next: vm.next,
    sentOn: longDate(application.submittedAt),
    journey:
      application.status === "draft"
        ? []
        : ARTIST_APPLICATION_JOURNEY.map((stage, index) => ({
            id: stage.id,
            label: stage.label,
            reached: index <= step,
            current: index === step,
          })),
    message,
    reapplyOn: state.next === "wait" ? longDate(state.availableFrom) : null,
    action,
  };
}
