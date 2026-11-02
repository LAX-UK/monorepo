import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import {
  NEEDS_CHANGES_LABEL,
  CONSIGNMENT_STAGE_LABEL as STAGE_LABEL,
} from "@/lib/seller/consignment-status";
import type { ConsignmentProgressStage } from "@auction/domain";

/**
 * How each of Home's progress stages reads: the names of the one stage list, with Needs changes
 * as the badge on In review.
 */
export const CONSIGNMENT_STAGE_LABEL: Record<ConsignmentProgressStage, string> = {
  under_review: STAGE_LABEL["in-review"],
  needs_changes: NEEDS_CHANGES_LABEL,
  accepted: STAGE_LABEL.accepted,
  in_sale: STAGE_LABEL["in-sale"],
  sold: STAGE_LABEL.sold,
  unsold: STAGE_LABEL.unsold,
};

/** The Consignments filter that shows one stage: its tab, narrowed to the works sent back for Needs changes. */
const STAGE_QUERY: Record<ConsignmentProgressStage, string> = {
  under_review: "tab=in-review",
  needs_changes: "tab=in-review&stage=needs_changes",
  accepted: "tab=accepted",
  in_sale: "tab=in-sale",
  sold: "tab=sold",
  unsold: "tab=unsold",
};

/** The Consignments list filtered to one stage. */
export function consignmentStageHref(stage: ConsignmentProgressStage): string {
  return `${CLIENT_ROUTES.consignments}?${STAGE_QUERY[stage]}`;
}

/** Filters inside the In review tab: the works the specialist sent back. */
export const REVIEW_STAGES = [
  "needs_changes",
] as const satisfies readonly ConsignmentProgressStage[];

export type ReviewStage = (typeof REVIEW_STAGES)[number];

/** Reads `?stage=` for the In review tab; anything else is ignored. */
export function parseReviewStage(value: string | undefined): ReviewStage | null {
  return REVIEW_STAGES.find((stage) => stage === value) ?? null;
}
