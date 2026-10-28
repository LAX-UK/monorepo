import type {
  ConsignmentAfterSaleStage,
  ConsignmentStage,
  ItemSubmissionStatus,
  LotStatus,
  UnsoldLotChoiceKind,
  UnsoldLotChoiceStatus,
} from "@auction/types";
import { lotEndedUnsold } from "./unsold-lot-choice.js";

export type { ConsignmentAfterSaleStage, ConsignmentStage };

const CHOICE_STAGE: Record<
  UnsoldLotChoiceStatus,
  Record<UnsoldLotChoiceKind, ConsignmentAfterSaleStage>
> = {
  requested: {
    relist: "relist_requested",
    private_sale: "private_sale_requested",
    collect: "collect_requested",
  },
  confirmed: {
    relist: "relist_confirmed",
    private_sale: "private_sale_confirmed",
    collect: "collect_confirmed",
  },
};

export type ConsignmentStageFacts = {
  submissionStatus: ItemSubmissionStatus;
  lot: { status: LotStatus; winnerId: string | null } | null;
  /** The choice for the lot's latest unsold outcome, if any. */
  unsoldChoice: {
    status: UnsoldLotChoiceStatus;
    requestedChoice: UnsoldLotChoiceKind | null;
    decidedChoice: UnsoldLotChoiceKind | null;
  } | null;
};

/**
 * A catalogued consignment whose lot ended without selling is "Unsold" until someone chooses,
 * then follows the request and the specialist's confirmation. Everything else keeps the
 * submission status.
 */
export function consignmentStage(facts: ConsignmentStageFacts): ConsignmentStage {
  if (facts.submissionStatus !== "converted" || !facts.lot || !lotEndedUnsold(facts.lot)) {
    return facts.submissionStatus;
  }
  const choice = facts.unsoldChoice;
  const kind =
    choice?.status === "confirmed" ? choice.decidedChoice : (choice?.requestedChoice ?? null);
  if (!choice || !kind) return "unsold";
  return CHOICE_STAGE[choice.status][kind];
}
