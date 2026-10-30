import type { ItemSubmissionStatus } from "./item-submission.js";

/** What a seller can ask for when a consigned lot ends without selling. */
export const unsoldLotChoiceKinds = ["relist", "private_sale", "collect"] as const;
export type UnsoldLotChoiceKind = (typeof unsoldLotChoiceKinds)[number];

/**
 * - `requested`: the seller chose; a specialist has not confirmed it yet.
 * - `confirmed`: a specialist confirmed it, as asked or adjusted.
 */
export const unsoldLotChoiceStatuses = ["requested", "confirmed"] as const;
export type UnsoldLotChoiceStatus = (typeof unsoldLotChoiceStatuses)[number];

/** One unsold outcome of a lot and what happens to it next. */
export type UnsoldLotChoice = {
  id: string;
  lotId: string;
  submissionId: string;
  legalEntityId: string;
  /** When the sale the lot did not sell in ended; each unsold outcome has its own choice. */
  lotEndTime: Date;
  status: UnsoldLotChoiceStatus;
  /** What the seller asked for; `null` when a specialist recorded it for them. */
  requestedChoice: UnsoldLotChoiceKind | null;
  /** The lower reserve the seller asked for a relist; `null` keeps the current reserve. */
  requestedReserve: string | null;
  requestedByUserId: string | null;
  requestedByName?: string | null;
  requestedAt: Date | null;
  /** What the specialist confirmed. */
  decidedChoice: UnsoldLotChoiceKind | null;
  decidedReserve: string | null;
  decidedByUserId: string | null;
  decidedByName?: string | null;
  decidedAt: Date | null;
  /** The specialist's note to the seller, shown when they adjust the request. */
  staffNote: string | null;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
};

export type UnsoldLotChoiceRequestInput = {
  choice: UnsoldLotChoiceKind;
  /** Only for a relist: a lower reserve, or `null` to keep the current one. */
  reserve?: string | null | undefined;
};

export type UnsoldLotChoiceDecisionInput = {
  choice: UnsoldLotChoiceKind;
  reserve?: string | null | undefined;
  note?: string | null | undefined;
};

/** A seller withdrawal request on a catalogued lot, as staff last left it. */
export type LotWithdrawalRequestState = {
  status: "pending" | "approved" | "declined";
  requestedAt: Date;
  decidedAt: Date | null;
  /** The staff reason, when it was declined. */
  reason: string | null;
};

/**
 * How a seller can take a consignment back:
 * - `withdraw_now`: before cataloguing, the seller withdraws it themselves.
 * - `request`: once catalogued, the seller asks and staff decide.
 * - `requested`: a request is waiting for staff.
 * - `unavailable`: nothing to withdraw (ended, sold, already withdrawn).
 */
export type ConsignmentWithdrawalPathKind =
  | "withdraw_now"
  | "request"
  | "requested"
  | "unavailable";

/** What the seller sees about an unsold lot. */
/** One of the account's consigned lots that ended without selling, and what was chosen. */
export type SellerUnsoldOutcome = {
  lotId: string;
  submissionId: string;
  title: string;
  /** When the sale it did not sell in ended (ISO 8601). */
  endedAt: string;
  /** The date the choice is due by (ISO 8601); if nobody chooses, LAX contacts the seller. */
  chooseBy: string;
  /** `none` while nobody has chosen. */
  choice: UnsoldLotChoiceStatus | "none";
};

export type SellerUnsoldLotView = {
  lotId: string;
  /** The lot's reserve when it ended; a relist may ask for a lower one. */
  currentReserve: string | null;
  /** The lowest reserve the specialist accepts for a relist, when they set one. */
  reserveFloor: string | null;
  currency: string;
  /** The date the choice is due by (ISO 8601); if nobody chooses, LAX contacts the seller. */
  chooseBy: string;
  choice: UnsoldLotChoice | null;
  /** The person may choose or change the choice for this account (capability matrix). */
  canChoose: boolean;
  /** The organisation's state pauses choices (restricted, unchecked or closed); LAX decides. */
  choicePaused: boolean;
};

/** After-sale facts for one consignment, for the seller. */
export type SellerAfterSaleView = {
  /** The consignment's stage, for its status pill. */
  stage: ConsignmentStage;
  unsold: SellerUnsoldLotView | null;
  withdrawal: {
    path: ConsignmentWithdrawalPathKind;
    /** The person may withdraw or ask to (capability matrix). */
    canAct: boolean;
    request: LotWithdrawalRequestState | null;
  };
};

/** After-sale facts for one consignment, for staff. */
export type StaffAfterSaleView = {
  unsold: Omit<SellerUnsoldLotView, "canChoose" | "choicePaused"> | null;
  withdrawal: LotWithdrawalRequestState | null;
};

/** An organisation a personal consignment can move to. */
export type ConsignmentMoveOption = {
  legalEntityId: string;
  displayName: string;
  /** The seller's role there. */
  role: string;
};

export type ConsignmentMoveRefusal =
  | "not_found"
  | "not_personal"
  | "catalogued"
  | "closed"
  | "same_account"
  | "not_member"
  | "role_cannot_submit"
  | "organisation_cannot_submit";

/** What staff see before moving a personal consignment to an organisation. */
export type ConsignmentMoveOptions = {
  movable: boolean;
  /** Why it cannot move, in words for staff. */
  reason: string | null;
  options: ConsignmentMoveOption[];
  /** What happens to the consignment agreement when it moves. */
  agreementEffect: "none" | "carried" | "reset";
};

/** When the seller was last reminded to verify their identity. */
export type SellerIdentityReminderState = {
  lastSentAt: Date | null;
  /** The earliest time another reminder may go out. */
  nextAllowedAt: Date | null;
};

/** After the sale, a consignment's stage follows its lot and the unsold choice. */
export const consignmentAfterSaleStages = [
  "unsold",
  "relist_requested",
  "private_sale_requested",
  "collect_requested",
  "relist_confirmed",
  "private_sale_confirmed",
  "collect_confirmed",
] as const;
export type ConsignmentAfterSaleStage = (typeof consignmentAfterSaleStages)[number];

/** What a seller sees as a consignment's stage: its submission status, or where it is after the sale. */
export type ConsignmentStage = ItemSubmissionStatus | ConsignmentAfterSaleStage;
