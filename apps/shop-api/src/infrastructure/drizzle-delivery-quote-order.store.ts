import type { Database } from "@auction/db";
import { shopBasket, shopDeliveryQuote, shopOrder } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  MAX_OPEN_QUOTE_REQUESTS_PER_BASKET_TOKEN,
  MAX_OPEN_QUOTE_REQUESTS_PER_BUYER,
  MAX_OPEN_QUOTE_REQUESTS_PER_GUEST_IP,
  reservedUntilFromCheckoutExpiry,
} from "@auction/shop-domain";
import { and, count, eq, inArray } from "drizzle-orm";
import type {
  CreateQuoteOrderInput,
  CreatedQuoteOrder,
  DeliveryQuoteOrderStore,
} from "../application/delivery-quote-request/delivery-quote-request.ports.js";
import type { BasketOwner } from "../application/ports/commerce.ports.js";
import type { ShopNotificationPublisher } from "../application/ports/shop-notification.publisher.js";
import { ShopApiError } from "../errors/shop-api-error.js";
import { isPgUniqueViolation, pgUniqueViolationConstraint } from "../lib/pg-errors.js";
import { receiptLineSummary } from "./drizzle-shop-notification.publisher.js";
import { expandBasketLines, loadCheckoutBasket } from "./shop-checkout-basket.js";
import { deliveryColumns } from "./shop-checkout-replay.js";
import { checkoutDeliveryDetails } from "./shop-checkout-replay.js";
import {
  reserveEditionsForCheckoutOrder,
  reserveProductVariantsForCheckoutOrder,
} from "./shop-checkout-reservation.js";
import { createShopDomainEventPublisher } from "./shop-domain-event-publisher.js";

const regionNames = new Intl.DisplayNames(["en-GB"], { type: "region" });
const dayFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** A basket belongs to an account's subject, or to a guest's anonymous basket token. */
function ownsBasket(owner: BasketOwner, input: CreateQuoteOrderInput): boolean {
  if (input.guest) {
    return owner.kind === "anonymous" && owner.tokenHash === input.guest.basketTokenHash;
  }
  return owner.kind === "subject" && owner.identitySubjectId === input.subject;
}

/**
 * The order that holds a basket's prints while the gallery quotes their delivery. It is a pending
 * order with no payment session: its checkout expiry is the hold, so the usual reaper releases the
 * prints and returns the basket if the quote is not paid in time, and nothing here can be paid
 * until a quote is accepted. The quote row carries the quote's status.
 */
export function createDrizzleDeliveryQuoteOrderStore(
  db: Database,
  options: {
    domainEventMode: "off" | "observe" | "enforce";
    vatPolicy?: import("@auction/shop-domain").VatPolicy | null;
    merchandiseEnabled?: boolean;
    notifications: Pick<ShopNotificationPublisher, "queueDeliveryQuoteRequested">;
  },
): DeliveryQuoteOrderStore {
  const merchandiseEnabled = options.merchandiseEnabled ?? false;
  const domainEvents = createShopDomainEventPublisher(options.domainEventMode);

  async function replayOf(idempotencyKey: string): Promise<CreatedQuoteOrder | null> {
    const [existing] = await db
      .select({
        orderId: shopOrder.id,
        orderReference: shopOrder.reference,
        holdUntil: shopDeliveryQuote.holdUntil,
        regionId: shopDeliveryQuote.regionId,
        country: shopDeliveryQuote.destinationCountry,
      })
      .from(shopOrder)
      .innerJoin(shopDeliveryQuote, eq(shopDeliveryQuote.orderId, shopOrder.id))
      .where(eq(shopOrder.idempotencyKey, idempotencyKey))
      .limit(1);
    return existing
      ? { ...existing, regionId: existing.regionId as CreatedQuoteOrder["regionId"] }
      : null;
  }

  const openQuote = inArray(shopDeliveryQuote.status, ["requested", "quoted"]);
  const tooMany = () =>
    new ShopApiError(
      SHOP_API_ERROR_CODES.CONFLICT,
      "There are already delivery quote requests waiting from this browser or network. Wait for a reply before asking again.",
      409,
    );

  /** A guest has no account to hold to account, so open holds are also capped per browser and IP. */
  async function assertGuestHoldsWithinCaps(
    basketTokenHash: string,
    ipHash: string | null,
  ): Promise<void> {
    const [byToken] = await db
      .select({ open: count() })
      .from(shopDeliveryQuote)
      .where(and(eq(shopDeliveryQuote.basketTokenHash, basketTokenHash), openQuote));
    if ((byToken?.open ?? 0) >= MAX_OPEN_QUOTE_REQUESTS_PER_BASKET_TOKEN) throw tooMany();
    if (!ipHash) return;
    const [byIp] = await db
      .select({ open: count() })
      .from(shopDeliveryQuote)
      .where(and(eq(shopDeliveryQuote.guestIpHash, ipHash), openQuote));
    if ((byIp?.open ?? 0) >= MAX_OPEN_QUOTE_REQUESTS_PER_GUEST_IP) throw tooMany();
  }

  return {
    async createQuoteOrder(input) {
      // A retry finds its request before the basket, which the first attempt has already retired.
      const earlier = await replayOf(input.idempotencyKey);
      if (earlier) return earlier;

      const basket = await loadCheckoutBasket(
        db,
        { basketId: input.basketId, ownedBy: (owner) => ownsBasket(owner, input) },
        { merchandiseEnabled },
      );

      const [open] = await db
        .select({ open: count() })
        .from(shopDeliveryQuote)
        .innerJoin(shopOrder, eq(shopDeliveryQuote.orderId, shopOrder.id))
        .where(
          and(
            eq(shopOrder.identitySubjectId, input.subject),
            inArray(shopDeliveryQuote.status, ["requested", "quoted"]),
          ),
        );
      if ((open?.open ?? 0) >= MAX_OPEN_QUOTE_REQUESTS_PER_BUYER) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.CONFLICT,
          "You already have delivery quote requests waiting. Wait for a reply, or cancel one, before asking again.",
          409,
        );
      }

      if (input.guest) {
        await assertGuestHoldsWithinCaps(input.guest.basketTokenHash, input.guestIpHash);
      }

      const details = checkoutDeliveryDetails({
        fulfilment: "international_quotation",
        deliveryAddress: input.deliveryAddress,
        deliveryPhone: input.deliveryPhone,
      });
      const reservedUntil = reservedUntilFromCheckoutExpiry(input.holdUntil);
      const { editionLines, variantLines } = expandBasketLines(basket.lines);

      try {
        return await db.transaction(async (tx) => {
          const [order] = await tx
            .insert(shopOrder)
            .values({
              identitySubjectId: input.subject,
              guestCustomerId: input.guest?.guestCustomerId ?? null,
              fulfilment: "international_quotation",
              merchandiseSubtotalPence: basket.merchandiseSubtotal,
              // The delivery price is not known until staff quote it; the total grows with it.
              fulfilmentSurchargePence: 0,
              fulfilmentVatPence: null,
              totalPence: basket.merchandiseSubtotal,
              idempotencyKey: input.idempotencyKey,
              checkoutExpiresAt: input.holdUntil,
              ...deliveryColumns(details),
            })
            .returning({ id: shopOrder.id, reference: shopOrder.reference });
          if (!order) {
            throw new ShopApiError(SHOP_API_ERROR_CODES.INTERNAL, "Failed to create order", 500);
          }

          await reserveProductVariantsForCheckoutOrder(tx as Database, {
            orderId: order.id,
            expandedLines: variantLines,
            vatPolicy: options.vatPolicy ?? null,
          });
          await reserveEditionsForCheckoutOrder(
            tx as Database,
            {
              orderId: order.id,
              reservedUntil,
              expandedLines: editionLines,
              vatPolicy: options.vatPolicy ?? null,
            },
            domainEvents,
          );

          await tx.insert(shopDeliveryQuote).values({
            orderId: order.id,
            status: input.status,
            guestIpHash: input.guest ? input.guestIpHash : null,
            basketTokenHash: input.guest ? input.guest.basketTokenHash : null,
            regionId: input.regionId,
            destinationCountry: input.country,
            holdUntil: input.holdUntil,
          });

          await tx
            .update(shopBasket)
            .set({ retiredAt: new Date(), updatedAt: new Date() })
            .where(eq(shopBasket.id, input.basketId));

          await options.notifications.queueDeliveryQuoteRequested(tx, {
            idempotencyKey: `delivery-quote-requested:${order.id}`,
            identitySubjectId: input.subject,
            fallbackEmail: input.fallbackEmail,
            orderReference: order.reference,
            countryName: regionNames.of(input.country) ?? input.country,
            holdUntilOn: dayFormat.format(input.holdUntil),
            itemsSummary: receiptLineSummary(
              basket.lines.flatMap((line) =>
                Array.from({ length: line.quantity }, () => ({
                  artworkTitle: line.artworkTitle ?? line.productTitle ?? "Item",
                  editionDetail: null,
                  unitPricePence: line.unitPricePence,
                })),
              ),
            ),
          });

          return {
            orderId: order.id,
            orderReference: order.reference,
            holdUntil: input.holdUntil,
            country: input.country,
            regionId: input.regionId,
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
          if (constraint === "shop_order_idempotency_key_uid" || constraint === null) {
            const raced = await replayOf(input.idempotencyKey);
            if (raced) return raced;
          }
        }
        throw error;
      }
    },
  };
}
