import { resumeOnboardingStepKey } from "@/components/organisations/org-onboarding-step-map";
import { orgOnboardingStepHref } from "@/lib/legal-entity/org-onboarding-resume";
import {
  ORGANISATION_PAYOUTS_PENDING_SUBMIT_REASON,
  ORGANISATION_UNDER_REVIEW_SUBMIT_REASON,
} from "@auction/domain";
import type { LegalEntityStatus } from "@auction/types";

/** The one step that moves an organisation's setup on, as a button label and where it goes. */
export type SetupStep = { label: string; href: string };

/**
 * The step an organisation still has to take, or `null` once setup is done or closed. The link
 * resumes where the person left off when the onboarding read says so.
 */
export function setupStep(
  status: LegalEntityStatus,
  entityId: string,
  resumeHref: string | null = null,
): SetupStep | null {
  const key = resumeOnboardingStepKey(status);
  if (!key) return null;
  return {
    label: status === "connect_pending" ? "Finish payout setup" : "Continue setup",
    href: resumeHref ?? orgOnboardingStepHref(key, { entityId }),
  };
}

/** What Sell a work says about an organisation whose setup holds back sending a work. */
export type OrganisationSellingNote = {
  /** The line under the organisation's card. */
  summary: string;
  /** The notice when the organisation is chosen: why the work can only be saved as a draft. */
  notice: string;
  /** What the person can do about it, when it is theirs to do. */
  step: SetupStep | null;
};

const DOCUMENTS_NEEDED: Omit<OrganisationSellingNote, "step"> = {
  summary: "Documents needed. You can save a draft now.",
  notice:
    "We're waiting for this organisation's documents. Send them to start the check; you can save the work as a draft meanwhile.",
};
const UNDER_REVIEW: Omit<OrganisationSellingNote, "step"> = {
  summary: "Under review. You can save a draft now.",
  notice: ORGANISATION_UNDER_REVIEW_SUBMIT_REASON,
};
const PAYOUTS_NOT_SET_UP: Omit<OrganisationSellingNote, "step"> = {
  summary: "Payouts not set up. You can save a draft now.",
  notice: ORGANISATION_PAYOUTS_PENDING_SUBMIT_REASON,
};

/** Every state that can draft but not send has its own words; the rest keep the default. */
const SELLING_NOTES: Partial<Record<LegalEntityStatus, Omit<OrganisationSellingNote, "step">>> = {
  lead: DOCUMENTS_NEEDED,
  docs_requested: DOCUMENTS_NEEDED,
  docs_received: UNDER_REVIEW,
  under_review: UNDER_REVIEW,
  connect_pending: PAYOUTS_NOT_SET_UP,
};

/**
 * What Sell a work says about an organisation by its status, from the same step rule as Your
 * organisations. `null` for a state with nothing special to say.
 */
export function organisationSellingNote(
  status: LegalEntityStatus,
  entityId: string,
): OrganisationSellingNote | null {
  const words = SELLING_NOTES[status];
  if (!words) return null;
  // Only a state waiting on the person (documents, payouts) offers the step; review is LAX's.
  const ownStep =
    status === "docs_received" || status === "under_review" ? null : setupStep(status, entityId);
  return { ...words, step: ownStep };
}
