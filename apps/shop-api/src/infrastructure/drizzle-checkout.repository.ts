import type { Database } from "@auction/db";
import { shopBasket, shopDeliveryQuote, shopOrder, shopOrderLine } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  type VatPolicy,
  addPence,
  computeOrderTotal,
  fulfilmentSurchargePence,
  isOnlineCheckoutFulfilment,
  orderTotalWithDelivery,
  pence,
  reservedUntilFromCheckoutExpiry,
} from "@auction/shop-domain";
import {
  isUkPostcode,
  newCheckoutHoldEnd,
  normalizeUkPostcode,
  vatIncludedIn,
} from "@auction/shop-domain";
import { eq } from "drizzle-orm";
import {
  type CheckoutMoneyPause,
  assertCheckoutNotPaused,
} from "../application/artwork-register/checkout-money-pause.js";
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
import { assertStorefrontRedirectUrl } from "./shop-basket.persistence.js";
import { expandBasketLines, loadCheckoutBasket } from "./shop-checkout-basket.js";
import { holdForNewSession } from "./shop-checkout-hold.js";
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

/** Payment outside the UK is not open: the refusal every outside-UK payment path shares. */
export function exportPaymentClosed(): ShopApiError {
  return new ShopApiError(
    SHOP_API_ERROR_CODES.CONFLICT,
    "Payment for delivery outside the UK is not open yet",
    409,
  );
}

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
    /** SHOP_FRAMING_ENABLED: while off, a framed basket is refused at checkout. */
    framingEnabled?: boolean;
    /**
     * Whether delivery outside the UK may be paid for. Off until the accountant confirms how VAT
     * applies to exports: with it off, no outside-UK order opens a payment, however it was made.
     */
    exportPaymentEnabled?: boolean;
    /** Refuses a basket holding an artwork Zoho says is sold while it is still for sale. */
    moneyPause?: CheckoutMoneyPause;
  },
): CheckoutWriter {
  const merchandiseEnabled = options.merchandiseEnabled ?? false;
  const framingEnabled = options.framingEnabled ?? false;
  const exportPaymentEnabled = options.exportPaymentEnabled ?? false;
  const domainEvents = createShopDomainEventPublisher(options.domainEventMode);

  /**
   * Refuses to open or return a payment session for an order holding an artwork whose money is
   * paused. Every path that can take payment for an existing order runs through this: a retry of
   * the same checkout, resuming a pending order, and (through resume) accepting a delivery quote
   * and the guest links.
   */
  async function assertOrderNotPaused(orderId: string): Promise<void> {
    if (!options.moneyPause) return;
    const lines = await db
      .select({ artworkId: shopOrderLine.artworkId })
      .from(shopOrderLine)
      .where(eq(shopOrderLine.orderId, orderId));
    await assertCheckoutNotPaused(
      options.moneyPause,
      lines.flatMap((line) => (line.artworkId ? [line.artworkId] : [])),
    );
  }

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
      checkoutExpiresAt:
        pending.needsStripeSession && orderRow
          ? await holdForNewSession(
              db,
              { id: orderRow.id, checkoutExpiresAt: pending.checkoutExpiresAt },
              {
                began: orderRow.createdAt,
                now: new Date(),
                isQuote: orderRow.fulfilment === "international_quotation",
              },
            )
          : pending.checkoutExpiresAt,
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
      // Outside the UK is payable here only at a region's fixed rate, which the caller has
      // already assessed; a quoted destination goes through the delivery quote request instead.
      const outsideUk = input.outsideUk;
      if (!isOnlineCheckoutFulfilment(input.fulfilment) && !outsideUk) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.VALIDATION,
          "Fulfilment not supported online",
          400,
        );
      }
      if (outsideUk) {
        if (!exportPaymentEnabled) throw exportPaymentClosed();
        if (input.fulfilment !== "international_quotation") {
          throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Fulfilment mismatch", 400);
        }
        if (deliveryAddress?.country.trim().toUpperCase() !== outsideUk.country) {
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.VALIDATION,
            "Delivery country does not match the delivery rate",
            400,
          );
        }
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
          checkoutExpiresAt: newCheckoutHoldEnd(new Date()),
        });

      // A retry finds its order before the basket, which the first attempt has already retired.
      const [earlier] = await db
        .select()
        .from(shopOrder)
        .where(eq(shopOrder.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (earlier) {
        await assertOrderNotPaused(earlier.id);
        return openPaymentSession(input, await replay(earlier));
      }

      const {
        lines: basketLines,
        merchandiseSubtotal,
        framingSubtotal,
      } = await loadCheckoutBasket(
        db,
        { basketId: input.basketId, ownedBy: (owner) => ownsBasket(owner, input) },
        { merchandiseEnabled, framingEnabled },
      );
      if (options.moneyPause) {
        await assertCheckoutNotPaused(
          options.moneyPause,
          basketLines.flatMap((line) => (line.artworkId ? [line.artworkId] : [])),
        );
      }

      const fulfilmentSurcharge = pence(
        outsideUk ? outsideUk.pricePence : fulfilmentSurchargePence(input.fulfilment),
      );
      const total = outsideUk
        ? addPence(addPence(merchandiseSubtotal, framingSubtotal), fulfilmentSurcharge)
        : computeOrderTotal({
            merchandiseSubtotalPence: merchandiseSubtotal,
            framingSubtotalPence: framingSubtotal,
            fulfilment: input.fulfilment,
          });
      const checkoutExpiresAt = newCheckoutHoldEnd(new Date());
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
              framingSubtotalPence: framingSubtotal,
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

          const { editionLines: expandedEditionLines, variantLines: expandedVariantLines } =
            expandBasketLines(basketLines);

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
          await assertOrderNotPaused(existing.id);
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
      await assertOrderNotPaused(order.id);
      // A pending order always has a hold; one without it, or past it, can no longer be paid.
      const holdEndsAt = order.checkoutExpiresAt;
      if (!holdEndsAt || holdEndsAt < new Date()) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, "Checkout session expired", 409);
      }
      // When the hold began for the two-hour ceiling: the buyer accepting a quote, else the order.
      let acceptedAt: Date | null = null;
      if (order.fulfilment === "international_quotation") {
        // Payment outside the UK is closed until VAT on exports is confirmed, for every order.
        if (!exportPaymentEnabled) throw exportPaymentClosed();
        const [quote] = await db
          .select({
            status: shopDeliveryQuote.status,
            quotedPricePence: shopDeliveryQuote.quotedPricePence,
            decidedAt: shopDeliveryQuote.decidedAt,
          })
          .from(shopDeliveryQuote)
          .where(eq(shopDeliveryQuote.orderId, order.id))
          .limit(1);
        acceptedAt = quote?.decidedAt ?? null;
        // No quote row means a fixed-rate order, paid like any other. A quote that has not been
        // accepted has no delivery price yet, so there is nothing to pay.
        if (quote && (quote.status !== "accepted" || quote.quotedPricePence === null)) {
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.CONFLICT,
            "This order is waiting for a delivery quote",
            409,
          );
        }
        // What is about to be paid must be exactly the goods, their framing and the delivery that was priced.
        const priced = quote?.quotedPricePence ?? order.fulfilmentSurchargePence;
        if (
          order.fulfilmentSurchargePence !== priced ||
          order.totalPence !==
            orderTotalWithDelivery({
              merchandiseSubtotalPence: order.merchandiseSubtotalPence,
              framingSubtotalPence: order.framingSubtotalPence,
              deliveryPence: priced,
            })
        ) {
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.CONFLICT,
            "The order total does not match its delivery price",
            409,
          );
        }
      }
      assertStorefrontRedirectUrl(input.successUrl, options.storefrontUrl);
      assertStorefrontRedirectUrl(input.cancelUrl, options.storefrontUrl);

      const [stripeLines, customerEmail] = await Promise.all([
        loadCheckoutStripePresentation(db, order.id),
        resolveShopUserEmail(db, input.subject),
      ]);

      // A new session must last at least as long as Stripe allows, so the hold and the
      // reservation are moved to match it first and the reaper never ends it early.
      const checkoutExpiresAt = order.stripeCheckoutSessionId
        ? holdEndsAt
        : await holdForNewSession(
            db,
            { id: order.id, checkoutExpiresAt: holdEndsAt },
            {
              began: acceptedAt ?? order.createdAt,
              now: new Date(),
              isQuote: order.fulfilment === "international_quotation",
            },
          );

      return resolveOrCreateStripeCheckoutSession(db, paymentGateway, {
        orderId: order.id,
        orderReference: order.reference,
        totalPence: order.totalPence,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        checkoutExpiresAt,
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
