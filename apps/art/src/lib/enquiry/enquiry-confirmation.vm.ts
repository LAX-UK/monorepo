import type { ArtViewerState } from "@/lib/art-viewer-state";
import type { ArtGeneralEnquiryTopic } from "@/lib/enquiry/submit-general-enquiry";
import { GALLERY_CONTACT } from "@auction/branding";
import {
  type MarketingEnquiryStep,
  type MarketingGalleryTeamDetail,
  marketingGalleryContactDetails,
} from "@auction/marketing-ui";

/** What the enquiry was about: a work on its page, or a topic from a general enquiry. */
export type EnquirySubjectKind = "artwork" | ArtGeneralEnquiryTopic;

/** The way on after sending: signed-in visitors track it, guests are invited to an account. */
export type EnquiryConfirmationFollowUp =
  | { kind: "track"; label: string; href: string }
  | { kind: "account"; label: string; href: string; note: string };

export type EnquiryConfirmationVm = {
  title: string;
  steps: MarketingEnquiryStep[];
  details: MarketingGalleryTeamDetail[];
  followUp: EnquiryConfirmationFollowUp;
};

const REPLY_TIME = "within one working day";

const READ_STEP: MarketingEnquiryStep = {
  title: "The gallery team reads your enquiry",
  body: `A member of the team who knows the work picks it up and replies ${REPLY_TIME}.`,
};

/** The second step depends on what was asked; the first and last are the same for everyone. */
const ANSWER_STEPS: Record<EnquirySubjectKind, MarketingEnquiryStep> = {
  artwork: {
    title: "We answer your questions",
    body: "Price, condition, framing, delivery: ask anything. Nothing is reserved or charged until you decide.",
  },
  general: {
    title: "We answer your questions",
    body: "By email, or by phone if you left a number and would rather talk.",
  },
  private_viewing: {
    title: "We suggest a time",
    body: "We propose a quiet time to see the works at the gallery, by appointment.",
  },
  art_advisory: {
    title: "An advisor gets in touch",
    body: "They ask what you are looking for, for a home, an office or a first original, and come back with works.",
  },
  selling: {
    title: "We point you to the right route",
    body: "Collectors sell through LAX Bid's Sell with LAX; artists apply to be represented.",
  },
  exhibition: {
    title: "We answer your questions",
    body: "About the exhibition, its artists and the works shown, by email or by phone.",
  },
};

const VISIT_STEP: MarketingEnquiryStep = {
  title: "See it in person, if you like",
  body: "Works can be seen by appointment at the gallery in Marylebone.",
};

/**
 * The confirmation shown once an enquiry is sent. It promises only what the gallery does: a
 * reply within one working day, and, once the enquiry is stored with a reference, the copy
 * emailed to the sender.
 */
export function buildEnquiryConfirmation(input: {
  viewer: Pick<ArtViewerState, "kind">;
  subject: EnquirySubjectKind;
  enquiriesHref?: string;
  registerHref?: string;
}): EnquiryConfirmationVm {
  const answer = ANSWER_STEPS[input.subject];
  const steps =
    input.subject === "private_viewing" ? [READ_STEP, answer] : [READ_STEP, answer, VISIT_STEP];
  return {
    title: "Enquiry sent",
    steps,
    details: marketingGalleryContactDetails(GALLERY_CONTACT),
    followUp:
      input.viewer.kind === "authenticated"
        ? {
            kind: "track",
            label: "Track this in Enquiries",
            href: input.enquiriesHref ?? "/account/enquiries",
          }
        : {
            kind: "account",
            label: "Create an account",
            href: input.registerHref ?? "/register",
            note: "With a LAX Account you can save works, follow artists and keep your enquiries in one place.",
          },
  };
}

/**
 * The promise under the tick, naming the address the reply goes to when the form had one. A
 * stored enquiry has a reference, and its sender is emailed a copy, so the lead says so.
 */
export function enquiryConfirmationLead(
  email: string | null | undefined,
  reference: string | null = null,
): string {
  const address = email?.trim();
  if (address && reference) {
    return `We've emailed you a copy at ${address}. The gallery team will reply ${REPLY_TIME}.`;
  }
  return address
    ? `The gallery team will reply to ${address} ${REPLY_TIME}.`
    : `The gallery team will reply ${REPLY_TIME}.`;
}
