import { SHOP_HELP_CONTACT } from "@/content/policies/help";
import {
  type CheckoutDeliveryTimes,
  type WorkingDayWindow,
  addWorkingDays,
  londonToday,
  workingDayWindowLine,
} from "@/lib/checkout/checkout-delivery";
import { formatDayMonthOnly, formatWeekdayDayMonth } from "@auction/datetime";
import { FULFILMENT_SURCHARGE_PENCE } from "@auction/shop-domain";
import { formatGbpPenceForDisplay } from "@auction/shop-portal/vm";

/** The dated delivery promise beside "Add to basket", from the same rules checkout offers. */
export type DeliveryEstimateVm = {
  /** "Arrives Tue 4 Nov – Thu 6 Nov with insured UK delivery, £15". */
  delivery: string;
  /** "Free collection from 156 New Cavendish St, London W1W 6YW, ready from Mon 3 Nov". */
  collection: string | null;
};

/**
 * Counted in working days from now in London, exactly as checkout counts them, so the date on the
 * edition page is the date checkout shows. Null without a configured delivery time; the page then
 * keeps its undated delivery line.
 */
export function presentDeliveryEstimate(input: {
  now: Date;
  times: CheckoutDeliveryTimes;
}): DeliveryEstimateVm | null {
  const { ukDelivery, collection } = input.times;
  if (!ukDelivery) return null;
  const deliveryPrice = formatGbpPenceForDisplay(FULFILMENT_SURCHARGE_PENCE.uk_insured_delivery);
  const collectionPence = FULFILMENT_SURCHARGE_PENCE.collect_new_cavendish;
  const collectionPrice =
    collectionPence === 0 ? "Free" : formatGbpPenceForDisplay(collectionPence);
  return {
    delivery: `${workingDayWindowLine(input.now, ukDelivery, "Arrives")} with insured UK delivery, ${deliveryPrice}`,
    collection: collection
      ? `${collectionPrice} collection from ${SHOP_HELP_CONTACT.address}, ${workingDayWindowLine(
          input.now,
          collection,
          "ready from",
        )}`
      : null,
  };
}

const dayMonth = { format: (date: Date) => formatDayMonthOnly(date, "UTC", { engineSept: true }) };
const dayMonthParts = {
  format: (date: Date) => formatWeekdayDayMonth(date, "UTC", { engineSept: true }),
};

/** "2 to 4 Nov", "30 Oct to 3 Nov" or "4 Nov": the days a window covers, from today in London. */
function arrivalRange(today: Date, window: WorkingDayWindow): string {
  const first = addWorkingDays(today, window.min);
  if (window.max === window.min) return dayMonth.format(first);
  const last = addWorkingDays(today, window.max);
  const sameMonth = first.getUTCMonth() === last.getUTCMonth();
  const start = sameMonth ? String(first.getUTCDate()) : dayMonth.format(first);
  return `${start} to ${dayMonth.format(last)}`;
}

/**
 * The delivery and collection windows pushed back by a framed print's lead time: framing is done
 * before the print is packed, so both ends of each window move by their own end of the lead time.
 */
export function shiftDeliveryTimes(
  times: CheckoutDeliveryTimes,
  lead: { minDays: number; maxDays: number } | null,
): CheckoutDeliveryTimes {
  if (!lead) return times;
  const shift = (window: WorkingDayWindow | null): WorkingDayWindow | null =>
    window ? { min: window.min + lead.minDays, max: window.max + lead.maxDays } : null;
  return { ukDelivery: shift(times.ukDelivery), collection: shift(times.collection) };
}

/**
 * The one delivery line under "Add to basket": "Insured UK delivery £15, arrives 2 to 4 Nov · Free
 * collection, ready Fri 30 Oct". Prices come from the surcharges checkout charges and the days
 * from the rules it counts by; a delivery time that is not configured is left out, not guessed.
 */
export function presentDeliveryLine(input: {
  now: Date;
  times: CheckoutDeliveryTimes;
  /** Working days a framed print adds first: the option's shortest and longest lead time. */
  framingLead?: { minDays: number; maxDays: number } | null;
}): string {
  const today = londonToday(input.now);
  const times = shiftDeliveryTimes(input.times, input.framingLead ?? null);
  const { ukDelivery, collection } = times;
  const deliveryPrice = formatGbpPenceForDisplay(FULFILMENT_SURCHARGE_PENCE.uk_insured_delivery);
  const collectionPence = FULFILMENT_SURCHARGE_PENCE.collect_new_cavendish;
  const delivery = `Insured UK delivery ${deliveryPrice}${
    ukDelivery ? `, arrives ${arrivalRange(today, ukDelivery)}` : ""
  }`;
  const collectionPrice =
    collectionPence === 0
      ? "Free collection"
      : `Collection ${formatGbpPenceForDisplay(collectionPence)}`;
  const ready = collection
    ? `, ready ${dayMonthParts.format(addWorkingDays(today, collection.min)).replace(",", "")}`
    : "";
  return `${delivery} · ${collectionPrice}${ready}`;
}
