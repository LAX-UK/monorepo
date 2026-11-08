import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { PAY_COPY } from "@/lib/pay/pay-copy";
import type { PurchaseState } from "./purchase-progress";

/** The most lots one payment covers; a larger count in the address is not one the page wrote. */
const MAX_PAID_LOTS = 20;

/** The purchase page a person lands on after paying, saying how many lots the payment covered. */
export function paidPurchaseHref(lotId: string, paidLots: number): string {
  return `${CLIENT_ROUTES.purchases}/${encodeURIComponent(lotId)}?paid=${paidLots}`;
}

/** What the purchase page reads from `?paid=`: a whole count the Pay page wrote, else nothing. */
export function parsePaidLots(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || !/^[1-9][0-9]?$/.test(value)) return null;
  const count = Number(value);
  return count <= MAX_PAID_LOTS ? count : null;
}

/** The states a purchase is in once the money has been taken. */
const PAID_STATES: ReadonlySet<PurchaseState> = new Set<PurchaseState>([
  "choose-delivery",
  "preparing",
  "ready-for-collection",
  "in-transit",
  "delivered",
  "collected",
]);

/** The notice that hands a person from paying to the next step. */
export type PurchaseHandoverVm = {
  title: string;
  detail: string;
  /** Takes the person to the choice of delivery; only while that choice is still theirs to make. */
  action: { label: string; href: string } | null;
};

/**
 * "Paid. Thank you." and the next step, shown on the purchase page a person is sent to after
 * paying. It states a fact the server holds: it appears only when the purchase really is paid,
 * whatever the address says, and offers "Choose delivery" only while delivery is still to be
 * chosen by this person.
 */
export function purchaseHandover(input: {
  paidLots: number | null;
  state: PurchaseState;
  canChooseDelivery: boolean;
  deliveryAnchor: string;
}): PurchaseHandoverVm | null {
  if (input.paidLots === null || !PAID_STATES.has(input.state)) return null;
  const choosing = input.state === "choose-delivery";
  return {
    title: PAY_COPY.paidTitle,
    detail: !choosing
      ? PAY_COPY.paidDetailDone
      : input.paidLots > 1
        ? PAY_COPY.paidDetailMany(input.paidLots)
        : PAY_COPY.paidDetailOne,
    action:
      choosing && input.canChooseDelivery
        ? { label: PAY_COPY.chooseDelivery, href: `#${input.deliveryAnchor}` }
        : null,
  };
}
