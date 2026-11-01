import type { ItemSubmissionStatus, LotStatus } from "@auction/types";

/** The six steps a consignment takes, from sending it to LAX to its sale. */
export const CONSIGNMENT_JOURNEY_STEPS = [
  "submitted",
  "review",
  "agreement",
  "catalogued",
  "in-sale",
  "sold",
] as const;
export type ConsignmentJourneyStep = (typeof CONSIGNMENT_JOURNEY_STEPS)[number];

export const CONSIGNMENT_JOURNEY_LABEL: Record<ConsignmentJourneyStep, string> = {
  submitted: "Submitted",
  review: "Review",
  agreement: "Agreement",
  catalogued: "Catalogued",
  "in-sale": "In sale",
  sold: "Sold",
};

export type ConsignmentJourneyFacts = {
  /** `null` for a lot the seller sees without its submission. */
  submissionStatus: ItemSubmissionStatus | null;
  /**
   * The specialist's agreement, as the status reads it: `open` waits on the seller; `none` (no
   * terms set) and `accepted` go on to cataloguing, so the step and the status badge agree.
   */
  agreement: "none" | "open" | "accepted";
  lot: { status: LotStatus; sold: boolean } | null;
};

export type ConsignmentJourney = {
  /** The step the consignment is on; every earlier step is done. */
  current: ConsignmentJourneyStep;
  /** True once the last step is reached and done (the work sold). */
  finished: boolean;
};

/** A catalogued work's step, from its lot. */
const LOT_STEP: Record<LotStatus, ConsignmentJourneyStep | null> = {
  draft: "catalogued",
  scheduled: "in-sale",
  active: "in-sale",
  ended: "in-sale",
  cancelled: null,
  voided: null,
};

/** A submission's step before it has a lot. Rejected or withdrawn work leaves the journey. */
function submissionStep(
  status: ItemSubmissionStatus,
  agreement: ConsignmentJourneyFacts["agreement"],
): ConsignmentJourneyStep | null {
  switch (status) {
    case "draft":
      return "submitted";
    case "submitted":
    case "under_review":
    case "changes_requested":
      return "review";
    case "approved":
    case "converted":
      return agreement === "open" ? "agreement" : "catalogued";
    default:
      return null;
  }
}

/** Where a consignment is on its way to sale, or `null` when it has left the journey. */
export function consignmentJourney(facts: ConsignmentJourneyFacts): ConsignmentJourney | null {
  if (facts.lot) {
    if (facts.lot.status === "ended" && facts.lot.sold) return { current: "sold", finished: true };
    const step = LOT_STEP[facts.lot.status];
    return step ? { current: step, finished: false } : null;
  }
  if (!facts.submissionStatus) return null;
  const step = submissionStep(facts.submissionStatus, facts.agreement);
  return step ? { current: step, finished: false } : null;
}

export type JourneyStepProgress = "done" | "current" | "upcoming";

/** Each step's progress, for a tracker or a segmented bar. */
export function journeyProgress(journey: ConsignmentJourney): {
  id: ConsignmentJourneyStep;
  label: string;
  progress: JourneyStepProgress;
}[] {
  const at = CONSIGNMENT_JOURNEY_STEPS.indexOf(journey.current);
  return CONSIGNMENT_JOURNEY_STEPS.map((id, index) => ({
    id,
    label: CONSIGNMENT_JOURNEY_LABEL[id],
    progress: index < at || journey.finished ? "done" : index === at ? "current" : "upcoming",
  }));
}

/** "Agreement, step 3 of 6", as the list says it (one fact, so no dot inside). */
export function journeyCaption(journey: ConsignmentJourney): string {
  const step = CONSIGNMENT_JOURNEY_STEPS.indexOf(journey.current) + 1;
  return `${CONSIGNMENT_JOURNEY_LABEL[journey.current]}, step ${step} of ${CONSIGNMENT_JOURNEY_STEPS.length}`;
}
