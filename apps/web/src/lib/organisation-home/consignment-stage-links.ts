import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type { ConsignmentProgressStage } from "@auction/domain";

/** How each consignment stage reads, wherever it is named. */
export const CONSIGNMENT_STAGE_LABEL: Record<ConsignmentProgressStage, string> = {
  under_review: "Under review",
  needs_changes: "Needs changes",
  accepted: "Accepted",
  in_sale: "In sale",
  sold: "Sold",
  unsold: "Unsold",
};

/** The Consignments filter that shows one stage: its tab, narrowed further while in review. */
const STAGE_QUERY: Record<ConsignmentProgressStage, string> = {
  under_review: "tab=in-review&stage=under_review",
  needs_changes: "tab=in-review&stage=needs_changes",
  accepted: "tab=in-review&stage=accepted",
  in_sale: "tab=in-sale",
  sold: "tab=sold",
  unsold: "tab=unsold",
};

/** The Consignments list filtered to one stage. */
export function consignmentStageHref(stage: ConsignmentProgressStage): string {
  return `${CLIENT_ROUTES.consignments}?${STAGE_QUERY[stage]}`;
}

/** Stages inside the "In review" tab, which the list can narrow to. */
export const REVIEW_STAGES = [
  "under_review",
  "needs_changes",
  "accepted",
] as const satisfies readonly ConsignmentProgressStage[];

export type ReviewStage = (typeof REVIEW_STAGES)[number];

/** Reads `?stage=` for the In review tab; anything else is ignored. */
export function parseReviewStage(value: string | undefined): ReviewStage | null {
  return REVIEW_STAGES.find((stage) => stage === value) ?? null;
}
