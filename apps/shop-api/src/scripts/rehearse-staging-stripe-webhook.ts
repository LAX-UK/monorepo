/**
 * Posts a signed checkout.session.completed webhook to staging shop-api ingress.
 * Used by shop-staging-acceptance instead of driving checkout.stripe.com payment UI in CI.
 */
import { closeDb, createDb } from "@auction/db";
import { shopArtwork, shopOrder } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { resetAcceptanceStripeCheckoutFixture } from "../infrastructure/seed/acceptance-commerce-seed.js";
import { SHOP_SEED_STRIPE_CHECKOUT_SLUG } from "../infrastructure/seed/catalogue-seed.js";
import { createPendingPaymentOrderWithReservedEdition } from "../test-support/shop-fixtures.js";

const webhookSecret = process.env.STRIPE_SHOP_WEBHOOK_SECRET?.trim();
const storefrontUrl = (process.env.SHOP_STOREFRONT_URL ?? "https://test-shop.lax.bid").replace(
  /\/$/,
  "",
);
const dbUrl = process.env.DATABASE_URL_SHOP?.trim() ?? process.env.DATABASE_URL?.trim();

if (!webhookSecret) {
  console.error("STRIPE_SHOP_WEBHOOK_SECRET is required for staging Stripe webhook rehearsal");
  process.exit(1);
}
if (!dbUrl) {
  console.error("DATABASE_URL_SHOP or DATABASE_URL is required");
  process.exit(1);
}

const db = createDb(dbUrl);

try {
  await resetAcceptanceStripeCheckoutFixture(db);

  const [artwork] = await db
    .select({ id: shopArtwork.id })
    .from(shopArtwork)
    .where(eq(shopArtwork.slug, SHOP_SEED_STRIPE_CHECKOUT_SLUG))
    .limit(1);
  if (!artwork) {
    throw new Error(
      `Missing artwork ${SHOP_SEED_STRIPE_CHECKOUT_SLUG}; run catalogue seed before webhook rehearsal`,
    );
  }

  const suffix = `staging-wh-${Date.now()}`;
  const pending = await createPendingPaymentOrderWithReservedEdition(db, {
    artworkId: artwork.id,
    suffix,
    totalPence: 4_200,
  });

  const created = Math.floor(Date.now() / 1000);
  const event = {
    id: `evt_${suffix}`,
    object: "event",
    api_version: "2024-06-20",
    type: "checkout.session.completed",
    created,
    livemode: false,
    data: {
      object: {
        id: pending.stripeSessionId,
        object: "checkout.session",
        payment_status: "paid",
        currency: "gbp",
        amount_total: pending.totalPence,
        metadata: { app: "shop", orderId: pending.orderId },
      },
    },
  };

  const payload = JSON.stringify(event);
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
  });

  const response = await fetch(`${storefrontUrl}/webhooks/stripe`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature,
    },
    body: payload,
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Staging webhook POST failed (${response.status}): ${responseText}`);
  }

  const [order] = await db
    .select({ status: shopOrder.status })
    .from(shopOrder)
    .where(eq(shopOrder.id, pending.orderId))
    .limit(1);
  if (order?.status !== "paid") {
    throw new Error(
      `Order ${pending.orderId} expected paid after webhook; got ${order?.status ?? "missing"}`,
    );
  }

  console.log(
    `shop-api: staging Stripe webhook rehearsal ok (order ${pending.orderId} marked paid)`,
  );
} finally {
  await closeDb(db);
}
