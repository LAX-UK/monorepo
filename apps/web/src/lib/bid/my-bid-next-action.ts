import { getMinNextBidAmount } from "@/lib/bid/lot-min-bid";
import { formatMoney, lotChargeCurrency } from "@/lib/format-currency";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { lotPath } from "@/lib/seo/url";
import type { Lot } from "@auction/types";
import type { MyBidStatus } from "./my-bid-status";

export type MyBidActionKind =
  | "bid-next"
  | "set-maximum"
  | "raise-maximum"
  | "edit-maximum"
  | "view-purchase";

export type MyBidAction = {
  kind: MyBidActionKind;
  label: string;
  href: string;
  emphasis: "primary" | "secondary";
};

/**
 * What a lot offers next, by status. The last entry is the one next step and carries the
 * emphasis; an outbid lot also offers setting a maximum instead of a single raise. Bidding
 * happens on the lot page, where the amount, terms and registration are confirmed.
 */
const ACTIONS_BY_STATUS: Record<MyBidStatus, readonly MyBidActionKind[]> = {
  outbid: ["set-maximum", "bid-next"],
  winning: ["raise-maximum"],
  "maximum-set": ["edit-maximum"],
  // An absentee bid is held by the saleroom; changing it goes through the team, not a button.
  absentee: [],
  won: ["view-purchase"],
  "not-won": [],
  withdrawn: [],
};

/** Raising a maximum or editing a bid is never the urgent step, so it stays secondary. */
const EMPHASIS: Record<MyBidActionKind, MyBidAction["emphasis"]> = {
  "bid-next": "primary",
  "set-maximum": "secondary",
  "raise-maximum": "secondary",
  "edit-maximum": "secondary",
  "view-purchase": "secondary",
};

function actionFor(kind: MyBidActionKind, lot: Lot): MyBidAction {
  const href = lotPath(lot);
  switch (kind) {
    case "bid-next": {
      const amount = getMinNextBidAmount(lot, lot.currentPrice);
      return {
        kind,
        label: `Bid ${formatMoney(amount, lotChargeCurrency(lot))}`,
        href,
        emphasis: EMPHASIS[kind],
      };
    }
    case "set-maximum":
      return { kind, label: "Set maximum", href, emphasis: EMPHASIS[kind] };
    case "raise-maximum":
      return { kind, label: "Raise maximum", href, emphasis: EMPHASIS[kind] };
    case "edit-maximum":
      return { kind, label: "Edit maximum", href, emphasis: EMPHASIS[kind] };
    case "view-purchase":
      return {
        kind,
        label: "View purchase",
        href: CLIENT_ROUTES.purchases,
        emphasis: EMPHASIS[kind],
      };
  }
}

/** The actions a lot shows, in reading order; empty when nothing is left to do. */
export function myBidActions(status: MyBidStatus, lot: Lot | null): MyBidAction[] {
  if (!lot) return [];
  return ACTIONS_BY_STATUS[status].map((kind) => actionFor(kind, lot));
}
