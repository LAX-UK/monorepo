import { type LotActionKind, type LotLifecycleKind, lotLifecycleCopy } from "./lifecycle-copy.js";
import type { LotPosition, LotRegistrationState } from "./viewer-state.js";

/** What the primary action is once the viewer's own standing is known. */
export type ResolvedLotAction =
  | Exclude<LotActionKind, "register_or_set_maximum">
  | "sign_in"
  | "register"
  | "registration_pending"
  | "registration_declined"
  | "set_maximum"
  /** The winner of an ended lot with an invoice to pay. */
  | "pay"
  /** The winner of an ended lot whose invoice is settled. */
  | "view_purchase";

export type LotActionInput = {
  lifecycle: LotLifecycleKind;
  signedIn: boolean;
  registrationRequired: boolean;
  registration: LotRegistrationState;
  /** The viewer's own position on the lot; a winner's action is about their purchase. */
  position?: LotPosition;
  /** The status of the invoice behind a lot the viewer won. */
  purchaseStatus?: WonPurchaseStatus | null;
};

export type WonPurchaseStatus =
  | "not_invoiced"
  | "due"
  | "overdue"
  | "processing"
  | "paid"
  | "refunded"
  | "cancelled";

/** What a winner does next, by the state of their invoice; other states keep the lot's own action. */
const WON_ACTION_BY_PURCHASE: Partial<Record<WonPurchaseStatus, ResolvedLotAction>> = {
  due: "pay",
  overdue: "pay",
  processing: "view_purchase",
  paid: "view_purchase",
};

const BIDDING_ACTIONS: ReadonlySet<LotActionKind> = new Set([
  "register_or_set_maximum",
  "bid",
  "bid_and_watch_saleroom",
]);

/**
 * The one primary action. Bidding actions give way to signing in or registering first; the
 * actions of an ended, withdrawn or paused lot never depend on who is looking.
 */
export function resolveLotAction(input: LotActionInput): ResolvedLotAction {
  const base = lotLifecycleCopy(input.lifecycle).action;
  if (input.lifecycle === "endedSold" && input.position === "won" && input.purchaseStatus) {
    const won = WON_ACTION_BY_PURCHASE[input.purchaseStatus];
    if (won) return won;
  }
  if (!BIDDING_ACTIONS.has(base)) {
    return base as Exclude<LotActionKind, "register_or_set_maximum">;
  }
  if (!input.signedIn) return "sign_in";
  if (input.registrationRequired) {
    if (input.registration === "pending") return "registration_pending";
    if (input.registration === "declined") return "registration_declined";
    if (input.registration !== "approved") return "register";
  }
  return base === "register_or_set_maximum"
    ? "set_maximum"
    : (base as "bid" | "bid_and_watch_saleroom");
}
