import { SHOP_HELP_CONTACT } from "@/content/policies/help";
import { type CheckoutDeliveryTimes, workingDayWindowLine } from "@/lib/checkout/checkout-delivery";
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
