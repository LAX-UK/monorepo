import { loadShopEnv } from "@/env";
import {
  type CheckoutDeliveryTimes,
  parseWorkingDayWindow,
} from "@/lib/checkout/checkout-delivery";

/**
 * Provisional times, in working days, used until operations set their own: UK insured delivery
 * in 3 to 5 days, collection ready in 2. They are awaiting business review.
 */
export const DEFAULT_UK_DELIVERY_WORKING_DAYS = "3-5";
export const DEFAULT_COLLECTION_READY_WORKING_DAYS = "2";

/** Delivery and collection times: the configured ones, or the provisional defaults. */
export function loadCheckoutDeliveryTimes(): CheckoutDeliveryTimes {
  const env = loadShopEnv();
  return {
    ukDelivery: parseWorkingDayWindow(
      env.SHOP_UK_DELIVERY_WORKING_DAYS ?? DEFAULT_UK_DELIVERY_WORKING_DAYS,
    ),
    collection: parseWorkingDayWindow(
      env.SHOP_COLLECTION_READY_WORKING_DAYS ?? DEFAULT_COLLECTION_READY_WORKING_DAYS,
    ),
  };
}
