import type { SaleHeroVM } from "@/lib/marketing/saleroom/view-models";

type SaleLifecycleStatus = SaleHeroVM["status"];

/** What a visitor can still do in a sale, by its lifecycle. */
export type SaleLifecycleActions = {
  /** Register to bid (or sign up to): only while bidding can still happen. */
  register: boolean;
  /** Follow the sale to hear when it opens or closes. */
  follow: boolean;
};

const OPEN: SaleLifecycleActions = { register: true, follow: true };
const CLOSED: SaleLifecycleActions = { register: false, follow: false };

/** One row per sale status; an ended sale is a results page, not an invitation to bid. */
const ACTIONS_BY_STATUS: Record<SaleLifecycleStatus, SaleLifecycleActions> = {
  draft: OPEN,
  scheduled: OPEN,
  active: OPEN,
  ended: CLOSED,
  cancelled: CLOSED,
  voided: CLOSED,
};

export function saleLifecycleActions(status: SaleLifecycleStatus): SaleLifecycleActions {
  return ACTIONS_BY_STATUS[status] ?? CLOSED;
}
