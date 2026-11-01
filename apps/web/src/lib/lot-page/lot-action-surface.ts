import type { ResolvedLotAction } from "@auction/domain";

/** Which part of the page carries the primary action. */
export type LotActionSurface =
  | "bid_entry"
  | "artist_alerts"
  | "enquire"
  | "back_to_sale"
  | "pay"
  | "view_purchase"
  | "none";

/**
 * One row per action the domain can resolve, so a new action is a new row rather than another
 * branch. Everything a bidder does to bid (signing in, registering, a maximum, the bid itself) is
 * the bid entry; the rest are plain links and toggles.
 */
export const LOT_ACTION_SURFACE: Readonly<Record<ResolvedLotAction, LotActionSurface>> = {
  bid: "bid_entry",
  bid_and_watch_saleroom: "bid_entry",
  bid_disabled: "bid_entry",
  set_maximum: "bid_entry",
  sign_in: "bid_entry",
  register: "bid_entry",
  registration_pending: "bid_entry",
  registration_declined: "bid_entry",
  get_artist_alerts: "artist_alerts",
  pay: "pay",
  view_purchase: "view_purchase",
  enquire: "enquire",
  back_to_sale: "back_to_sale",
  none: "none",
};
