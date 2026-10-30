import type { Database } from "@auction/db";
import { shopBasket, shopOrder } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  type VatPolicy,
  computeMerchandiseSubtotal,
  computeOrderTotal,
  fulfilmentSurchargePence,
  isOnlineCheckoutFulfilment,
  pence,
  reservedUntilFromCheckoutExpiry,
} from "@auction/shop-domain";
import { isUkPostcode, normalizeUkPostcode, vatIncludedIn } from "@auction/shop-domain";
import { eq } from "drizzle-orm";
import type {
  BasketOwner,
  CheckoutOrderInput,
  CheckoutWriter,
  PaymentCheckoutGateway,
} from "../application/ports/commerce.ports.js";
import { ShopApiError } from "../errors/shop-api-error.js";
import { isPgUniqueViolation, pgUniqueViolationConstraint } from "../lib/pg-errors.js";
import { cancelShopCheckoutSession } from "./drizzle-payment-event.processor.js";
import { resolveShopUserEmail } from "./resolve-shop-user-email.js";
import {
  assertBasketStock,
  assertStorefrontRedirectUrl,
  loadBasketRecord,
  repriceBasketLinesIfNeeded,
} from "./shop-basket.persistence.js";
import {
  type ReplayedCheckout,
  checkoutDeliveryDetails,
  deliveryColumns,
  replayCheckoutOrder,
} from "./shop-checkout-replay.js";
import {
  reserveEditionsForCheckoutOrder,
  reserveProductVariantsForCheckoutOrder,
} from "./shop-checkout-reservation.js";
import { loadCheckoutStripePresentation } from "./shop-checkout-stripe-presentation.js";
import { resolveOrCreateStripeCheckoutSession } from "./shop-checkout-stripe-session.js";
import { createShopDomainEventPublisher } from "./shop-domain-event-publisher.js";

const CHECKOUT_SESSION_TTL_MS = 30 * 60 * 1000;

/** A signed-in order needs the shopper's basket; a guest order the browser's anonymous one. */
function ownsBasket(owner: BasketOwner, input: CheckoutOrderInput): boolean {
  if (input.guest) {
    return owner.kind === "anonymous" && owner.tokenHash === input.guest.basketTokenHash;
  }
  return owner.kind === "subject" && owner.identitySubjectId === input.subject;
}

export function createDrizzleCheckoutRepository(
  db: Database,
  paymentGateway: PaymentCheckoutGateway,
  options: {
    storefrontUrl: string;
    domainEventMode: "off" | "observe" | "enforce";
    vatPolicy?: VatPolicy | null;
    merchandiseEnabled?: boolean;
  },
): CheckoutWriter {
  const merchandiseEnabled = options.merchandiseEnabled ?? false;
  const domainEvents = createShopDomainEventPublisher(options.domainEventMode);

  /** The payment session for a pending order: the open one, or a new one when it needs one. */
  async function openPaymentSession(
    input: { subject: string; successUrl: string; cancelUrl: string },
    pending: ReplayedCheckout,
  ) {
    const [orderRow] = await db
      .select()
      .from(shopOrder)
      .where(eq(shopOrder.id, pending.orderId))
      .limit(1);
    const [stripeLines, customerEmail] = await Promise.all([
      loadCheckoutStripePresentation(db, pending.orderId),
      resolveShopUserEmail(db, input.subject),
    ]);
    return resolveOrCreateStripeCheckoutSession(db, paymentGateway, {
      orderId: pending.orderId,
      orderReference: orderRow?.reference ?? null,
      totalPence: pending.totalPence,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      checkoutExpiresAt: pending.checkoutExpiresAt,
      needsStripeSession: pending.needsStripeSession,
      existingSessionId: orderRow?.stripeCheckoutSessionId ?? null,
      existingCheckoutExpiresAt: orderRow?.checkoutExpiresAt ?? null,
      lines: stripeLines,
      fulfilmentSurchargePence: orderRow?.fulfilmentSurchargePence ?? 0,
      customerEmail,
      ...(pending.sessionRevision ? { sessionRevision: pending.sessionRevision } : {}),
    });
  }

  return {
    async createCheckoutOrder(input) {
      let deliveryAddress = input.deliveryAddress;
      if (!isOnlineCheckoutFulfilment(input.fulfilment)) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.VALIDATION,
          "Fulfilment not supported online",
          400,
        );
      }
      if (input.fulfilment === "uk_insured_delivery") {
        const address = deliveryAddress;
        if (
          !address?.line1?.trim() ||
          !address.city?.trim() ||
          !address.postcode?.trim() ||
          !address.country?.trim()
        ) {
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.VALIDATION,
            "Delivery address is required",
            400,
          );
        }
        if (!isUkPostcode(address.postcode)) {
          throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Enter a valid UK postcode", 400);
        }
        const country = address.country.trim().toUpperCase();
        if (country !== "GB" && country !== "UK") {
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.VALIDATION,
            "UK insured delivery requires a GB delivery address",
            400,
          );
        }
        deliveryAddress = {
          ...address,
          country: "GB",
          postcode: normalizeUkPostcode(address.postcode),
        };
      }
      assertStorefrontRedirectUrl(input.successUrl, options.storefrontUrl);
      assertStorefrontRedirectUrl(input.cancelUrl, options.storefrontUrl);

      const details = checkoutDeliveryDetails({
        fulfilment: input.fulfilment,
        deliveryAddress,
        deliveryPhone: input.deliveryPhone,
      });
      const replay = (existing: typeof shopOrder.$inferSelect) =>
        replayCheckoutOrder(db, paymentGateway, existing, {
          subject: input.subject,
          details,
          checkoutExpiresAt: new Date(Date.now() + CHECKOUT_SESSION_TTL_MS),
        });

      // A retry finds its order before the basket, which the first attempt has already retired.
      const [earlier] = await db
        .select()
        .from(shopOrder)
        .where(eq(shopOrder.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (earlier) {
        return openPaymentSession(input, await replay(earlier));
      }

      const basket = await loadBasketRecord(db, input.basketId);
      if (!ownsBasket(basket.owner, input)) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.FORBIDDEN, "Basket ownership mismatch", 403);
      }
      if (basket.lines.length === 0) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Basket is empty", 400);
      }
      if (!merchandiseEnabled && basket.lines.some((line) => line.productVariantId != null)) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.FEATURE_DISABLED,
          "Merchandise is disabled",
          404,
        );
      }
      const repriced = await repriceBasketLinesIfNeeded(db, input.basketId);
      if (repriced) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.PRICE_CHANGED, "Basket price changed", 409);
      }
      await assertBasketStock(db, input.basketId);
      const freshBasket = await loadBasketRecord(db, input.basketId);

      const merchandiseSubtotal = computeMerchandiseSubtotal(
        freshBasket.lines.map((line) => ({
          unitPricePence: pence(line.unitPricePence),
          quantity: line.quantity,
        })),
      );
      const fulfilmentSurcharge = pence(fulfilmentSurchargePence(input.fulfilment));
      const total = computeOrderTotal({
        merchandiseSubtotalPence: merchandiseSubtotal,
        fulfilment: input.fulfilment,
      });
      const checkoutExpiresAt = new Date(Date.now() + CHECKOUT_SESSION_TTL_MS);
      const reservedUntil = reservedUntilFromCheckoutExpiry(checkoutExpiresAt);

      let pending: ReplayedCheckout | { replayOf: typeof shopOrder.$inferSelect };
      try {
        pending = await db.transaction(async (tx) => {
          const locked = await tx
            .select()
            .from(shopOrder)
            .where(eq(shopOrder.idempotencyKey, input.idempotencyKey))
            .for("update")
            .limit(1);
          const existing = locked[0];
          if (existing) {
            return { replayOf: existing };
          }

          const [order] = await tx
            .insert(shopOrder)
            .values({
              identitySubjectId: input.subject,
              guestCustomerId: input.guest?.guestCustomerId ?? null,
              fulfilment: input.fulfilment,
              merchandiseSubtotalPence: merchandiseSubtotal,
              fulfilmentSurchargePence: fulfilmentSurcharge,
              // Delivery is charged at the goods' rate; without a VAT policy no VAT is recorded.
              fulfilmentVatPence: options.vatPolicy
                ? vatIncludedIn(fulfilmentSurcharge, options.vatPolicy.standardRateBp)
                : null,
              totalPence: total,
              idempotencyKey: input.idempotencyKey,
              checkoutExpiresAt,
              ...deliveryColumns(details),
            })
            .returning({ id: shopOrder.id });
          if (!order) {
            throw new ShopApiError(SHOP_API_ERROR_CODES.INTERNAL, "Failed to create order", 500);
          }

          const expandedEditionLines: Array<{ artworkId: string; unitPricePence: number }> = [];
          const expandedVariantLines: Array<{ productVariantId: string; unitPricePence: number }> =
            [];
          for (const line of freshBasket.lines) {
            for (let i = 0; i < line.quantity; i++) {
              if (line.productVariantId) {
                expandedVariantLines.push({
                  productVariantId: line.productVariantId,
                  unitPricePence: line.unitPricePence,
                });
              } else if (line.artworkId) {
                expandedEditionLines.push({
                  artworkId: line.artworkId,
                  unitPricePence: line.unitPricePence,
                });
              }
            }
          }

          await reserveProductVariantsForCheckoutOrder(tx as Database, {
            orderId: order.id,
            expandedLines: expandedVariantLines,
            vatPolicy: options.vatPolicy ?? null,
          });

          await reserveEditionsForCheckoutOrder(
            tx as Database,
            {
              orderId: order.id,
              reservedUntil,
              expandedLines: expandedEditionLines,
              vatPolicy: options.vatPolicy ?? null,
            },
            domainEvents,
          );

          await tx
            .update(shopBasket)
            .set({ retiredAt: new Date(), updatedAt: new Date() })
            .where(eq(shopBasket.id, input.basketId));

          return {
            orderId: order.id,
            totalPence: total,
            checkoutExpiresAt,
            needsStripeSession: true,
          };
        });
      } catch (error) {
        if (isPgUniqueViolation(error)) {
          const constraint = pgUniqueViolationConstraint(error);
          if (
            constraint === "shop_order_line_edition_active_uid" ||
            constraint === "shop_order_line_edition_uid"
          ) {
            throw new ShopApiError(SHOP_API_ERROR_CODES.OUT_OF_STOCK, "Edition unavailable", 409);
          }
          if (constraint !== "shop_order_idempotency_key_uid" && constraint !== null) {
            throw error;
          }
          const [existing] = await db
            .select()
            .from(shopOrder)
            .where(eq(shopOrder.idempotencyKey, input.idempotencyKey))
            .limit(1);
          if (!existing) {
            throw new ShopApiError(SHOP_API_ERROR_CODES.INTERNAL, "Checkout idempotency race", 500);
          }
          pending = await replay(existing);
        } else {
          throw error;
        }
      }

      return openPaymentSession(
        input,
        "replayOf" in pending ? await replay(pending.replayOf) : pending,
      );
    },
    async resumeCheckoutOrder(input) {
      const [order] = await db
        .select()
        .from(shopOrder)
        .where(eq(shopOrder.id, input.orderId))
        .limit(1);
      if (!order) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.NOT_FOUND, "Order not found", 404);
      }
      if (order.identitySubjectId !== input.subject) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.FORBIDDEN, "Order ownership mismatch", 403);
      }
      if (order.status !== "pending_payment") {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.CONFLICT,
          "Order is no longer checkoutable",
          409,
        );
      }
      if (order.checkoutExpiresAt && order.checkoutExpiresAt < new Date()) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, "Checkout session expired", 409);
      }
      assertStorefrontRedirectUrl(input.successUrl, options.storefrontUrl);
      assertStorefrontRedirectUrl(input.cancelUrl, options.storefrontUrl);

      const [stripeLines, customerEmail] = await Promise.all([
        loadCheckoutStripePresentation(db, order.id),
        resolveShopUserEmail(db, input.subject),
      ]);

      return resolveOrCreateStripeCheckoutSession(db, paymentGateway, {
        orderId: order.id,
        orderReference: order.reference,
        totalPence: order.totalPence,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        checkoutExpiresAt:
          order.checkoutExpiresAt ?? new Date(Date.now() + CHECKOUT_SESSION_TTL_MS),
        needsStripeSession: !order.stripeCheckoutSessionId,
        existingSessionId: order.stripeCheckoutSessionId,
        existingCheckoutExpiresAt: order.checkoutExpiresAt,
        lines: stripeLines,
        fulfilmentSurchargePence: order.fulfilmentSurchargePence,
        customerEmail,
      });
    },

    async cancelCheckoutOrder(input) {
      const locked = await db
        .select({ id: shopOrder.id, identitySubjectId: shopOrder.identitySubjectId })
        .from(shopOrder)
        .where(eq(shopOrder.id, input.orderId))
        .limit(1);
      const order = locked[0];
      if (!order) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.NOT_FOUND, "Order not found", 404);
      }
      if (order.identitySubjectId !== input.subject) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.FORBIDDEN, "Order ownership mismatch", 403);
      }
      await cancelShopCheckoutSession(
        db,
        {
          eventId: `buyer-cancel:${input.orderId}`,
          orderId: input.orderId,
          source: "buyer",
        },
        { paymentGateway },
      );
    },
  };
}
