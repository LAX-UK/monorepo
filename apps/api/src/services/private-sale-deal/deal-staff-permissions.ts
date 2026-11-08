import { type DealScope, type DealTermField, dealInScope } from "@auction/domain";
import type { AdminDealTerms, StaffDealAction } from "@auction/validators";

/**
 * What a staff member may do on a deal, resolved from their capabilities by the route. The desk
 * decides which move or term each ability covers, so a new move is a row in a table, not a new
 * branch in the routes.
 */
export type DealStaffAbilities = {
  /** Run the deal: offers, agreement, cancelling, the price and the arrangements around it. */
  manage: boolean;
  /** Money: the invoice, the VAT treatment, the fee and commission, and refunds. */
  finance: boolean;
  /** Hand a paid work over. */
  release: boolean;
};

export type DealAbility = keyof DealStaffAbilities;

export type DealStaffViewer = {
  userId: string;
  abilities: DealStaffAbilities;
  /**
   * May see how the parties' identity, screening and source of funds stand. Only those who run
   * the deal or decide the checks; finance and fulfilment work without them.
   */
  checks: boolean;
  /** Which deals the person may see and act on at all. */
  scope: DealScope;
};

export const ACTION_ABILITY: Readonly<Record<StaffDealAction, DealAbility>> = {
  open_offer: "manage",
  agree: "manage",
  clear: "manage",
  cancel: "manage",
  issue_invoice: "finance",
  refund: "finance",
  release: "release",
};

/** Each term the desk edits, who may change it, and the rule that says when it is still open. */
export type TermRule = {
  ability: DealAbility;
  /** Null for a term that is open only while the deal is being offered. */
  field: DealTermField | null;
};

export const TERM_RULES: Readonly<Record<keyof AdminDealTerms, TermRule>> = {
  priceMinor: { ability: "manage", field: "price" },
  costsMinor: { ability: "manage", field: "costs" },
  partiesDisclosed: { ability: "manage", field: "partiesDisclosed" },
  offerExpiresAt: { ability: "manage", field: null },
  buyerFeeBps: { ability: "finance", field: "buyerFee" },
  sellerCommissionBps: { ability: "finance", field: "sellerCommission" },
  vatTreatment: { ability: "finance", field: "vatTreatment" },
};

export const canDo = (viewer: DealStaffViewer, ability: DealAbility): boolean =>
  viewer.abilities[ability];

/** Whether the deal is one this person may see and act on. */
export const canSeeDeal = (
  viewer: DealStaffViewer,
  deal: { stage: Parameters<typeof dealInScope>[0]["stage"]; ownerUserId: string | null },
): boolean => dealInScope(deal, viewer.scope);
