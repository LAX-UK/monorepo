import type { Database } from "@auction/db";
import type {
  CommerceRepository,
  PaymentCheckoutGateway,
} from "../application/ports/commerce.ports.js";
import { createDrizzleBasketRepository } from "./drizzle-basket.repository.js";
import { createDrizzleCheckoutRepository } from "./drizzle-checkout.repository.js";
import { createDrizzleOrderRepository } from "./drizzle-order.repository.js";

export {
  completeShopCheckoutSession,
  expireShopCheckoutSession,
  createDrizzlePaymentEventProcessor,
} from "./drizzle-payment-event.processor.js";

export function createDrizzleCommerceRepository(
  db: Database,
  paymentGateway: PaymentCheckoutGateway,
  options: {
    storefrontUrl: string;
    domainEventMode: "off" | "observe" | "enforce";
    vatPolicy?: import("@auction/shop-domain").VatPolicy | null;
    merchandiseEnabled?: boolean;
    /** Copies of one edition an order may hold; null or absent leaves only the stock. */
    editionOrderLimit?: number | null;
  },
): CommerceRepository {
  const basket = createDrizzleBasketRepository(db, {
    merchandiseEnabled: options.merchandiseEnabled ?? false,
    editionOrderLimit: options.editionOrderLimit ?? null,
  });
  const checkout = createDrizzleCheckoutRepository(db, paymentGateway, options);
  const orders = createDrizzleOrderRepository(db);
  return { ...basket, ...checkout, ...orders };
}
