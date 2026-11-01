import type { ItemSubmissionStatus, LotStatus } from "@auction/types";
import type { StatusBadgeShape, StatusBadgeTone } from "@auction/ui/lax";

/**
 * Where a consignment stands, as the seller reads it: one status from its submission, its
 * agreement, its lot and, after an unsold sale, the choice about what happens next.
 */
export type ConsignmentStatus =
  | "draft"
  | "in_review"
  | "needs_changes"
  | "agreement"
  | "preparing"
  | "in_sale"
  | "live"
  | "sold"
  | "choose_unsold"
  | "unsold"
  | "not_accepted"
  | "withdrawn"
  | "cancelled";

/**
 * The one list of stages a consignment moves through, in order. Tabs, badges, filters, search and
 * Home's stage counts all read these names; a new stage is a new entry. `id` is the tab's address.
 */
export const CONSIGNMENT_STAGES = [
  { id: "drafts", label: "Draft" },
  { id: "in-review", label: "In review" },
  { id: "accepted", label: "Accepted" },
  { id: "in-sale", label: "In a sale" },
  { id: "sold", label: "Sold" },
  { id: "unsold", label: "Did not sell" },
] as const;

export type ConsignmentOpenStage = (typeof CONSIGNMENT_STAGES)[number]["id"];

/** The stage a status belongs to; `closed` work (not accepted, withdrawn) shows only under All. */
export type ConsignmentStage = ConsignmentOpenStage | "closed";

export const CONSIGNMENT_STAGE_LABEL: Record<ConsignmentOpenStage, string> = Object.fromEntries(
  CONSIGNMENT_STAGES.map(({ id, label }) => [id, label]),
) as Record<ConsignmentOpenStage, string>;

/** The badge that rides on the In review stage when the specialist is waiting on the seller. */
export const NEEDS_CHANGES_LABEL = "Needs changes";

export type ConsignmentStatusPresentation = {
  label: string;
  tone: StatusBadgeTone;
  shape: StatusBadgeShape;
  stage: ConsignmentStage;
};

/**
 * How each status reads and which stage holds it. Its label is the stage's name, apart from
 * "Needs changes", the one badge on In review; what the member must do next is the row's step,
 * not a stage. A status that waits on the seller (changes, the agreement, the unsold choice) asks
 * for attention; work moving on its own is information; a sale is good news; finished or closed
 * work is neutral.
 */
export const CONSIGNMENT_STATUS: Record<ConsignmentStatus, ConsignmentStatusPresentation> = {
  draft: { label: "Draft", tone: "neutral", shape: "ring", stage: "drafts" },
  in_review: { label: "In review", tone: "info", shape: "dot", stage: "in-review" },
  needs_changes: {
    label: NEEDS_CHANGES_LABEL,
    tone: "warning",
    shape: "alert",
    stage: "in-review",
  },
  agreement: { label: "Accepted", tone: "warning", shape: "alert", stage: "accepted" },
  preparing: { label: "Accepted", tone: "info", shape: "dot", stage: "accepted" },
  in_sale: { label: "In a sale", tone: "info", shape: "dot", stage: "in-sale" },
  live: { label: "In a sale", tone: "live", shape: "dot", stage: "in-sale" },
  sold: { label: "Sold", tone: "success", shape: "check", stage: "sold" },
  choose_unsold: {
    label: "Did not sell",
    tone: "warning",
    shape: "alert",
    stage: "unsold",
  },
  unsold: { label: "Did not sell", tone: "neutral", shape: "ring", stage: "unsold" },
  not_accepted: { label: "Not accepted", tone: "neutral", shape: "ring", stage: "closed" },
  withdrawn: { label: "Withdrawn", tone: "neutral", shape: "ring", stage: "closed" },
  cancelled: { label: "Withdrawn from sale", tone: "neutral", shape: "ring", stage: "closed" },
};

export type ConsignmentStatusFacts = {
  /** `null` for a lot with no submission behind it. */
  submission: ItemSubmissionStatus | null;
  /** The specialist's terms: none yet, waiting to be accepted, or accepted. */
  agreement: "none" | "open" | "accepted";
  lot: { status: LotStatus; sold: boolean } | null;
  /** After an unsold sale: nothing chosen yet, or a choice made; `null` before then. */
  unsoldChoice: "none" | "made" | null;
};

const SUBMISSION_STATUS: Record<ItemSubmissionStatus, ConsignmentStatus> = {
  draft: "draft",
  submitted: "in_review",
  under_review: "in_review",
  changes_requested: "needs_changes",
  approved: "preparing",
  converted: "preparing",
  rejected: "not_accepted",
  withdrawn: "withdrawn",
};

function lotStatus(lot: NonNullable<ConsignmentStatusFacts["lot"]>, facts: ConsignmentStatusFacts) {
  switch (lot.status) {
    case "draft":
      return "preparing";
    case "scheduled":
      return "in_sale";
    case "active":
      return "live";
    case "ended":
      if (lot.sold) return "sold";
      return facts.unsoldChoice === "none" ? "choose_unsold" : "unsold";
    case "cancelled":
    case "voided":
      return "cancelled";
  }
}

/** The one status a consignment shows; the lot decides once there is one. */
export function consignmentStatus(facts: ConsignmentStatusFacts): ConsignmentStatus {
  if (facts.lot) return lotStatus(facts.lot, facts);
  const status = facts.submission ? SUBMISSION_STATUS[facts.submission] : "preparing";
  // An accepted work waits on the seller's agreement before it can be catalogued.
  return status === "preparing" && facts.agreement === "open" ? "agreement" : status;
}
