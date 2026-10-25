import { loadShopEnv } from "@/env";
import {
  type CheckoutDeliveryTimes,
  parseWorkingDayWindow,
} from "@/lib/checkout/checkout-delivery";

/** The delivery and collection times operations have configured; unset ones show no time. */
export function loadCheckoutDeliveryTimes(): CheckoutDeliveryTimes {
  const env = loadShopEnv();
  return {
    ukDelivery: parseWorkingDayWindow(env.SHOP_UK_DELIVERY_WORKING_DAYS),
    collection: parseWorkingDayWindow(env.SHOP_COLLECTION_READY_WORKING_DAYS),
  };
}
