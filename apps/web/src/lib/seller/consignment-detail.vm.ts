import type { ItemSubmission, Lot } from "@auction/types";
import {
  type ConsignmentJourney,
  type ConsignmentJourneyFacts,
  consignmentJourney,
  journeyProgress,
} from "./consignment-journey";

export type ConsignmentDetailVm = {
  image: string | null;
  /** One line under the title: medium and size, then the lot when it has one. */
  meta: string | null;
  /** The six steps, or `null` once the work has left the way to sale (rejected, withdrawn). */
  steps: ReturnType<typeof journeyProgress> | null;
  /** "About the work": only the facts that are known. */
  facts: { label: string; value: string }[];
  /** The work's page once it is catalogued. */
  listingHref: string | null;
};

const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function known(label: string, value: string | null | undefined) {
  return value?.trim() ? [{ label, value: value.trim() }] : [];
}

/** The consignment page's head, steps and facts, from the submission and its lot. */
export function buildConsignmentDetailVm(input: {
  submission: ItemSubmission;
  lot: Pick<Lot, "status" | "winnerId" | "lotNumber"> | null;
  agreement: ConsignmentJourneyFacts["agreement"];
  listingHref: string | null;
}): ConsignmentDetailVm {
  const { submission, lot } = input;
  const journey: ConsignmentJourney | null = consignmentJourney({
    submissionStatus: submission.status,
    agreement: input.agreement,
    lot: lot ? { status: lot.status, sold: Boolean(lot.winnerId) } : null,
  });
  const lotLabel = lot?.lotNumber == null ? null : `Lot ${lot.lotNumber}`;
  const meta = [submission.medium, submission.dimensions, lotLabel]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" · ");
  return {
    image: submission.images[0] ?? null,
    meta: meta || null,
    steps: journey ? journeyProgress(journey) : null,
    facts: [
      ...known("Medium", submission.medium),
      ...known("Size", submission.dimensions),
      ...known("Date", submission.yearOfWork),
      ...known("Lot", lotLabel),
      { label: "Submitted", value: LONG_DATE.format(submission.createdAt) },
    ],
    listingHref: input.listingHref,
  };
}
