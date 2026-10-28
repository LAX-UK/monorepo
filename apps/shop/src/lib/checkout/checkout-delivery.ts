import { SHOP_HELP_CONTACT } from "@/content/policies/help";
import type { ShopFulfilmentOption } from "@auction/shop-contracts";
import { fulfilmentSurchargePence } from "@auction/shop-domain";
import { formatGbpPence } from "@auction/shop-portal/vm";

/**
 * What checkout offers, in the order shown. Collection is from the gallery on New Cavendish
 * Street only. The other fulfilment values shop-api still accepts (a second collection point and
 * storage) are staff arrangements, not choices a shopper makes online. Outside the UK is listed so
 * the shopper learns it is not available online yet, instead of finding no option at all.
 */
export const CHECKOUT_DELIVERY_CHOICES = [
  "uk_insured_delivery",
  "collect_new_cavendish",
  "international_quotation",
] as const satisfies readonly ShopFulfilmentOption[];

export type CheckoutDeliveryChoice = (typeof CHECKOUT_DELIVERY_CHOICES)[number];

export function isCheckoutDeliveryChoice(value: string): value is CheckoutDeliveryChoice {
  return (CHECKOUT_DELIVERY_CHOICES as readonly string[]).includes(value);
}

/** The choices that can be paid for online; outside the UK cannot yet. */
export function isPayableDeliveryChoice(
  choice: CheckoutDeliveryChoice,
): choice is Exclude<CheckoutDeliveryChoice, "international_quotation"> {
  return choice !== "international_quotation";
}

/** A span of working days, such as 3 to 5. Configured per deployment; see `parseWorkingDayWindow`. */
export type WorkingDayWindow = { min: number; max: number };

/**
 * "3-5" or "2" from configuration. Anything else, or a span wider than five working days (a wide
 * window reads as no promise at all), is treated as not configured, so no time is shown.
 */
export function parseWorkingDayWindow(raw: string | undefined): WorkingDayWindow | null {
  const match = /^\s*(\d{1,2})\s*(?:-\s*(\d{1,2}))?\s*$/.exec(raw ?? "");
  if (!match) return null;
  const min = Number(match[1]);
  const max = match[2] === undefined ? min : Number(match[2]);
  if (min < 1 || max < min || max - min > 4) return null;
  return { min, max };
}

/** "3 to 5 working days", or "2 working days" for a single day count. */
export function workingDaysLabel(window: WorkingDayWindow): string {
  const span = window.min === window.max ? `${window.min}` : `${window.min} to ${window.max}`;
  return `${span} working ${window.max === 1 ? "day" : "days"}`;
}

/** Today's calendar date in London, as a UTC midnight so day arithmetic ignores clock changes. */
export function londonToday(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
}

/** The date `days` working days (Monday to Friday) after `from`. Bank holidays are not known. */
export function addWorkingDays(from: Date, days: number): Date {
  const date = new Date(from);
  let left = days;
  while (left > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) left -= 1;
  }
  return date;
}

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
});

const formatDay = (date: Date) => dayFormat.format(date).replace(",", "");

export type CheckoutDeliveryOptionVm = {
  value: CheckoutDeliveryChoice;
  label: string;
  /** "£15.00" or "Free"; null where online checkout cannot price it. */
  price: string | null;
  /** What the shopper gets, in plain words. */
  description: string;
  /** "Arrives Tue 4 Nov – Thu 6 Nov"; null when no delivery time is configured. */
  timing: string | null;
};

export type CheckoutDeliveryTimes = {
  ukDelivery: WorkingDayWindow | null;
  collection: WorkingDayWindow | null;
};

function arrivalLine(today: Date, window: WorkingDayWindow, verb: string): string {
  const first = formatDay(addWorkingDays(today, window.min));
  if (window.max === window.min) return `${verb} ${first}`;
  return `${verb} ${first} – ${formatDay(addWorkingDays(today, window.max))}`;
}

/**
 * "Arrives Tue 4 Nov – Thu 6 Nov" counted from a moment in London, such as when an order was
 * paid, so the confirmation repeats the window checkout showed.
 */
export function workingDayWindowLine(from: Date, window: WorkingDayWindow, verb: string): string {
  return arrivalLine(londonToday(from), window, verb);
}

const priceLabel = (pence: number) => (pence === 0 ? "Free" : formatGbpPence(pence));

/** The delivery choices as checkout lists them, with prices from the surcharges charged. */
export function presentCheckoutDeliveryOptions(input: {
  now: Date;
  times: CheckoutDeliveryTimes;
}): CheckoutDeliveryOptionVm[] {
  const today = londonToday(input.now);
  const { ukDelivery, collection } = input.times;
  return [
    {
      value: "uk_insured_delivery",
      label: "UK insured delivery",
      price: priceLabel(fulfilmentSurchargePence("uk_insured_delivery")),
      description: ukDelivery
        ? `${workingDaysLabel(ukDelivery)}, packed and insured to your door`
        : "Packed and insured to your door",
      timing: ukDelivery ? arrivalLine(today, ukDelivery, "Arrives") : null,
    },
    {
      value: "collect_new_cavendish",
      label: "Collect from our London gallery",
      price: priceLabel(fulfilmentSurchargePence("collect_new_cavendish")),
      description: `${SHOP_HELP_CONTACT.address}, by appointment. We will contact you to arrange a time.`,
      timing: collection ? arrivalLine(today, collection, "Ready from") : null,
    },
    {
      value: "international_quotation",
      label: "Delivery outside the UK",
      price: null,
      description: "Not available online yet",
      timing: null,
    },
  ];
}

/** The summary's delivery row for a choice, from the same surcharge checkout charges. */
export function checkoutDeliverySummaryRow(choice: ShopFulfilmentOption): {
  label: string;
  value: string;
  pence: number;
} {
  switch (choice) {
    case "collect_new_cavendish":
    case "collect_brunswick":
      return {
        label: "Collection in London",
        value: priceLabel(fulfilmentSurchargePence(choice)),
        pence: fulfilmentSurchargePence(choice),
      };
    case "international_quotation":
      return { label: "Delivery outside the UK", value: "Not available online", pence: 0 };
    case "lax_storage":
      return {
        label: "Storage with LAX",
        value: priceLabel(fulfilmentSurchargePence(choice)),
        pence: fulfilmentSurchargePence(choice),
      };
    case "uk_insured_delivery":
      return {
        label: "UK insured delivery",
        value: formatGbpPence(fulfilmentSurchargePence(choice)),
        pence: fulfilmentSurchargePence(choice),
      };
  }
}
