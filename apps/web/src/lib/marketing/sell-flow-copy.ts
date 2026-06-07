import type { ItemSubmissionStatus } from "@auction/types";

/** Seller-facing status labels — see docs/sell-flow-ux.md */
export const SELLER_SUBMISSION_STATUS_LABELS: Record<ItemSubmissionStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Accepted",
  converted: "Catalogue prep",
  rejected: "Not accepted",
  withdrawn: "Withdrawn",
};

export const SELL_JOURNEY_STEPS = [
  {
    id: "discover",
    label: "Discover",
    description: "Read what we accept and gather photos & details.",
  },
  {
    id: "account",
    label: "Account",
    description: "Sign in with a verified email to save your progress.",
  },
  { id: "submit", label: "Submit", description: "Complete the 6-step wizard — about 3 minutes." },
  {
    id: "review",
    label: "Specialist review",
    description: "Our team vets your object within 24 hours.",
  },
  {
    id: "listed",
    label: "Listed",
    description: "Accepted work is catalogued and scheduled for sale.",
  },
] as const;

export const SELL_PREREQUISITES = [
  "1+ photos of the item (3+ recommended: overall, detail, signature or markings)",
  "Title, description, dimensions, and medium — include artist or maker in the title or description",
  "Provenance or acquisition history, if available",
  "A verified email on your LAX account (required to submit)",
  "Stripe Connect for payouts (complete after acceptance — not required to start)",
] as const;

export const SELL_TIME_EXPECTATIONS =
  "~3 minutes to submit · Progress saves automatically · Response within 24 hours";

/** Opening paragraph for `/sell` LegalPage intro. */
export const SELL_PAGE_INTRO =
  "LAX.BID works with consignors to place fine art, watches, motor cars, design, and exceptional objects into carefully edited online timed sales and in-person saleroom events. Our specialists guide each consignment from first review through catalogue, sale, payment, and settlement.";

/** Acceptance criteria prose — heart of legacy “What we accept”. */
export const SELL_PAGE_ACCEPTANCE =
  "We review editorial fine art and exceptional objects with clear provenance, condition information, and market fit for upcoming auctions. Share photographs, dimensions, artist or maker details (in your title or description), acquisition history, and any available documentation when you submit an item.";

/** Post-submission consignment workflow — heart of legacy “How consignment works”. */
export const SELL_PAGE_CONSIGNMENT_WORKS =
  "Start with a submission, then our team vets the object, confirms sale suitability, prepares catalogue materials, coordinates photography and logistics, and markets the lot to collectors. After the auction, we coordinate payment, buyer handover, and consignor settlement.";

export const SELL_AUTH_INTENT_BANNER =
  "Sign in or create an account to start your consignment submission. Takes about 3 minutes. You'll need photos and basic object details.";

export const SELL_PHOTO_TIPS = [
  "Shoot in natural daylight or neutral indoor light — avoid harsh flash.",
  "Include an overall view, close-up details, and signature or markings.",
  "Keep the camera parallel to the work; include a scale reference when helpful.",
  "Upload the highest resolution your connection allows — we accept up to 20 images.",
] as const;

/** Shown while editing an in-progress submission in the wizard (autosave chrome only). */
export const SUBMISSION_AUTOSAVE_EXPLAINER = "Saved automatically";

export const SUBMISSION_FINISH_LATER_LABEL = "Save and finish later";

export const SUBMISSION_SUBMIT_LABEL = "Submit for specialist review";

export const SUBMISSION_READY_TO_SUBMIT_BANNER =
  "Ready to submit — specialists usually respond within 24 hours.";

export const SUBMISSION_LEAVE_WITHOUT_SAVING_LABEL = "Leave without saving";

export const SUBMISSION_LEAVE_WITHOUT_SAVING_HINT =
  "Recent edits may already be saved automatically.";

/** Collapsible hints on the Review step — not a second progress timeline. */
export const SUBMISSION_AFTER_SUBMIT_HINTS = [
  "Submitted — our specialists begin review, usually within 24 hours.",
  "Under review — we may contact you if we need more detail or photos.",
  "Accepted — we prepare catalogue materials; complete Stripe Connect when prompted.",
  "Listed — your work is scheduled for an upcoming sale.",
] as const;

/** One-line status copy on read-only submission detail pages. */
export const SUBMISSION_STATUS_HINTS: Partial<Record<ItemSubmissionStatus, string>> = {
  draft: "Complete your submission and submit for specialist review.",
  submitted: "Our specialists will start review within 24 hours.",
  under_review: "Our specialists are reviewing your submission.",
  approved: "Accepted — we are preparing your catalogue entry. Complete Connect when prompted.",
  converted: "Catalogue entry in progress — finish checklist items below.",
  rejected:
    "Not accepted — read the reason below and start a new submission if you wish to resubmit.",
  withdrawn: "Withdrawn — you can start a new submission when ready.",
};

export const WIZARD_STEP_SUMMARIES: Record<string, string> = {
  basics: "Title, category, year, and edition details.",
  details: "Medium, dimensions, signature, and catalogue description.",
  photos: "Upload images — first image becomes the primary catalogue image.",
  provenance: "Ownership history and exhibition records.",
  pricing: "Estimate, reserve preference, condition notes, and notes for specialists.",
  review: "Check your details and submit for specialist review.",
};

/** @deprecated Use SUBMISSION_AUTOSAVE_EXPLAINER — kept for test migration only. */
export const SUBMISSION_DRAFT_EXPLAINER = SUBMISSION_AUTOSAVE_EXPLAINER;
