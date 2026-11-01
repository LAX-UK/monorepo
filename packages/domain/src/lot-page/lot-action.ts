import { type LotActionKind, type LotLifecycleKind, lotLifecycleCopy } from "./lifecycle-copy.js";
import type { LotRegistrationState } from "./viewer-state.js";

/** What the primary action is once the viewer's own standing is known. */
export type ResolvedLotAction =
  | Exclude<LotActionKind, "register_or_set_maximum">
  | "sign_in"
  | "register"
  | "registration_pending"
  | "registration_declined"
  | "set_maximum";

export type LotActionInput = {
  lifecycle: LotLifecycleKind;
  signedIn: boolean;
  registrationRequired: boolean;
  registration: LotRegistrationState;
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
