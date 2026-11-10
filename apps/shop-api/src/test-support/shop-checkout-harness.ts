import { shopEdition, shopOrder } from "@auction/db/schema";
import { eq, sql } from "drizzle-orm";
import type pg from "pg";
import type {
  CheckoutOrderInput,
  PaymentCheckoutGateway,
} from "../application/ports/commerce.ports.js";
import { createDrizzleCommerceRepository } from "../infrastructure/drizzle-commerce.repository.js";
import {
  grantLaxSaleAuthority,
  importTestArtwork,
  integrationSuffix,
  requireDefined,
} from "./shop-fixtures.js";
import { createShopDb } from "./shop-integration-setup.js";

/** A payment gateway that hands out predictable test sessions. */
export const shopCheckoutGateway: PaymentCheckoutGateway = {
  async createHostedCheckout(input) {
    const sessionId = `cs_test_${input.orderId}`;
    return {
      sessionId,
      paymentIntentId: null,
      checkoutUrl: `https://pay.example.test/${sessionId}`,
    };
  },
  async resolveHostedCheckout(input) {
    return { checkoutUrl: `https://pay.example.test/${input.sessionId}` };
  },
  retrievePaidCheckout: async () => null,
  async expireHostedCheckout() {
    return { kind: "expired" };
  },
};

/** One print on sale, and buyers who can each put it in a basket and start checkout. */
export async function setupShopCheckout(shopPool: pg.Pool, label: string) {
  const db = createShopDb(shopPool);
  const imported = await importTestArtwork(db, label, { printPricePence: 8_000 });
  await grantLaxSaleAuthority(db, imported.artworkId, 1);
  const repo = createDrizzleCommerceRepository(db, shopCheckoutGateway, {
    storefrontUrl: "http://localhost:3020",
    domainEventMode: "off",
  });
  const checkout = async (buyer: string) => {
    const subject = `subject-${integrationSuffix(`${label}-${buyer}`)}`;
    const basket = await repo.addOrUpdateLine({
      owner: { kind: "subject", identitySubjectId: subject },
      artworkSlug: imported.slug,
      quantity: 1,
    });
    const request: CheckoutOrderInput = {
      subject,
      basketId: basket.basketId,
      fulfilment: "uk_insured_delivery",
      idempotencyKey: `checkout:${basket.basketId}:order`,
      successUrl: "http://localhost:3020/checkout/confirmation?orderId={ORDER_ID}",
      cancelUrl: "http://localhost:3020/checkout/cancel?orderId={ORDER_ID}",
      deliveryAddress: {
        recipientName: "Ada Lovelace",
        line1: "1 High Street",
        city: "London",
        postcode: "SW1A 1AA",
        country: "GB",
      },
      deliveryPhone: "07700 900123",
    };
    return repo.createCheckoutOrder(request);
  };
  const order = async (orderId: string) =>
    requireDefined(
      (await db.select().from(shopOrder).where(eq(shopOrder.id, orderId)).limit(1))[0],
      "order",
    );
  // The print on sale: the edition an order holds if one does, else the first. The run may
  // have more than one edition, and the rows do not come back in a fixed order unless asked.
  const holder = async () =>
    requireDefined(
      (
        await db
          .select()
          .from(shopEdition)
          .where(eq(shopEdition.artworkId, imported.artworkId))
          .orderBy(sql`${shopEdition.reservedByOrderId} is null`, shopEdition.editionNumber)
      )[0],
      "edition",
    );
  const pastHold = (orderId: string) =>
    db
      .update(shopOrder)
      .set({ checkoutExpiresAt: new Date(Date.now() - 60_000) })
      .where(eq(shopOrder.id, orderId));
  return { db, repo, checkout, order, holder, pastHold };
}
