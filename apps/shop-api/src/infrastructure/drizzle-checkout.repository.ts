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
import { isUkPostcode, normalizeUkPostcode } from "@auction/shop-domain";
import { eq } from "drizzle-orm";
import type {
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
import { assertReplayableCheckoutOrder } from "./shop-checkout-order-validation.js";
import { reserveEditionsForCheckoutOrder } from "./shop-checkout-reservation.js";
import { loadCheckoutStripePresentation } from "./shop-checkout-stripe-presentation.js";
import { resolveOrCreateStripeCheckoutSession } from "./shop-checkout-stripe-session.js";
import { createShopDomainEventPublisher } from "./shop-domain-event-publisher.js";

const CHECKOUT_SESSION_TTL_MS = 30 * 60 * 1000;

export function createDrizzleCheckoutRepository(
  db: Database,
  paymentGateway: PaymentCheckoutGateway,
  options: {
    storefrontUrl: string;
    domainEventMode: "off" | "observe" | "enforce";
    vatPolicy?: VatPolicy | null;
  },
): CheckoutWriter {
  const domainEvents = createShopDomainEventPublisher(options.domainEventMode);
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

      const basket = await loadBasketRecord(db, input.basketId);
      if (basket.owner.kind !== "subject" || basket.owner.identitySubjectId !== input.subject) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.FORBIDDEN, "Basket ownership mismatch", 403);
      }
      if (basket.lines.length === 0) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Basket is empty", 400);
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

      type PendingCheckout = {
        orderId: string;
        totalPence: number;
        checkoutExpiresAt: Date;
        needsStripeSession: boolean;
      };

      let pending: PendingCheckout;
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
            assertReplayableCheckoutOrder(existing, {
              subject: input.subject,
              fulfilment: input.fulfilment,
            });
            return {
              orderId: existing.id,
              totalPence: existing.totalPence,
              checkoutExpiresAt: existing.checkoutExpiresAt ?? checkoutExpiresAt,
              needsStripeSession: !existing.stripeCheckoutSessionId,
            };
          }

          const [order] = await tx
            .insert(shopOrder)
            .values({
              identitySubjectId: input.subject,
              fulfilment: input.fulfilment,
              merchandiseSubtotalPence: merchandiseSubtotal,
              fulfilmentSurchargePence: fulfilmentSurcharge,
              totalPence: total,
              idempotencyKey: input.idempotencyKey,
              checkoutExpiresAt,
              deliveryLine1: deliveryAddress?.line1 ?? null,
              deliveryLine2: deliveryAddress?.line2 ?? null,
              deliveryCity: deliveryAddress?.city ?? null,
              deliveryPostcode: deliveryAddress?.postcode ?? null,
              deliveryCountry: deliveryAddress?.country ?? null,
            })
            .returning({ id: shopOrder.id });
          if (!order) {
            throw new ShopApiError(SHOP_API_ERROR_CODES.INTERNAL, "Failed to create order", 500);
          }

          const expandedLines: Array<{ artworkId: string; unitPricePence: number }> = [];
          for (const line of freshBasket.lines) {
            for (let i = 0; i < line.quantity; i++) {
              expandedLines.push({
                artworkId: line.artworkId,
                unitPricePence: line.unitPricePence,
              });
            }
          }

          await reserveEditionsForCheckoutOrder(
            tx as Database,
            {
              orderId: order.id,
              reservedUntil,
              expandedLines,
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
          assertReplayableCheckoutOrder(existing, {
            subject: input.subject,
            fulfilment: input.fulfilment,
          });
          pending = {
            orderId: existing.id,
            totalPence: existing.totalPence,
            checkoutExpiresAt: existing.checkoutExpiresAt ?? checkoutExpiresAt,
            needsStripeSession: !existing.stripeCheckoutSessionId,
          };
        } else {
          throw error;
        }
      }

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
        totalPence: pending.totalPence,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        checkoutExpiresAt: pending.checkoutExpiresAt,
        needsStripeSession: pending.needsStripeSession,
        existingSessionId: orderRow?.stripeCheckoutSessionId ?? null,
        existingCheckoutExpiresAt: orderRow?.checkoutExpiresAt ?? null,
        lines: stripeLines,
        fulfilmentSurchargePence: orderRow?.fulfilmentSurchargePence ?? fulfilmentSurcharge,
        customerEmail,
      });
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
