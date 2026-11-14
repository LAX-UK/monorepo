import type { Database } from "@auction/db";
import { shopOrder, shopOriginalSale } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import type { OriginalOfferRegister } from "../application/ports/original-offer-register.js";
import type { ShopNotificationPublisher } from "../application/ports/shop-notification.publisher.js";
import type { StripeMoneyWebhookOutcome } from "../application/ports/stripe-money-webhook.types.js";
import { completeRefundFromWebhook } from "./handlers/webhooks/complete-refund.handler.js";
import { handleStripeDisputeWebhook } from "./handlers/webhooks/stripe-dispute.handler.js";
import {
  completeOriginalSaleFromPaymentLink,
  completeOriginalSaleFromStripeInvoice,
} from "./phase/drizzle-original-sale.writer.js";
import type { ShopDomainEventPublisherMode } from "./shop-domain-event-publisher.js";
import type { UnappliedMoneyLookup } from "./shop-unapplied-payment.js";
import { ORIGINAL_SALE_PAYMENT_APP } from "./stripe-shop-invoice.gateway.js";
import {
  isShopOwnedPaymentIntentMetadata,
  parseDisputeEvent,
  parseOriginalSalePaymentLinkPaid,
  parseStripeRefundEvent,
} from "./stripe-webhook.dto.js";

export function createDrizzleStripeMoneyWebhookProcessor(
  db: Database,
  options: {
    domainEventMode: ShopDomainEventPublisherMode;
    offers?: OriginalOfferRegister;
    notifications?: ShopNotificationPublisher;
    opsAlertEmail?: string | null;
    /** Where a second payment for an original already paid is recorded for finance. */
    unappliedMoney?: UnappliedMoneyLookup;
    fetchPaymentIntentMetadata?: (
      paymentIntentId: string,
    ) => Promise<Stripe.Metadata | null | undefined>;
  },
): {
  processMoneyWebhook(event: Stripe.Event): Promise<StripeMoneyWebhookOutcome>;
} {
  const fetchMetadata = options.fetchPaymentIntentMetadata;

  return {
    async processMoneyWebhook(event) {
      if (event.type === "invoice.paid") {
        const invoice = event.data.object as Stripe.Invoice;
        if (typeof invoice.id !== "string") {
          return "ignored";
        }
        const paidAt = invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : new Date();
        const outcome = await completeOriginalSaleFromStripeInvoice(db, {
          stripeInvoiceId: invoice.id,
          paidAt,
          domainEventMode: options.domainEventMode,
          ...(options.offers ? { offers: options.offers } : {}),
        });
        if (outcome === "ignored") {
          return "ignored";
        }
        return "processed";
      }

      // An original whose invoice Books issues, paid through its Payment Link.
      const original = parseOriginalSalePaymentLinkPaid(event);
      if (original) {
        const outcome = await completeOriginalSaleFromPaymentLink(db, {
          ...original,
          domainEventMode: options.domainEventMode,
          ...(options.offers ? { offers: options.offers } : {}),
          ...(options.unappliedMoney ? { unappliedMoney: options.unappliedMoney } : {}),
        });
        return outcome === "ignored" ? "ignored" : "processed";
      }

      const refundDto = parseStripeRefundEvent(event);
      if (refundDto) {
        const [order] = await db
          .select({ id: shopOrder.id })
          .from(shopOrder)
          .where(eq(shopOrder.stripePaymentIntentId, refundDto.paymentIntentId))
          .limit(1);
        if (!order) {
          const metadata = fetchMetadata ? await fetchMetadata(refundDto.paymentIntentId) : null;
          const original = await originalSaleOfPayment(db, refundDto.paymentIntentId, metadata);
          if (original) {
            return alertOriginalSaleMoneyReturned(db, options, {
              originalSaleId: original,
              eventId: refundDto.eventId,
              paymentIntentId: refundDto.paymentIntentId,
              detail: `Refund ${refundDto.stripeRefundId} (${refundDto.status}) of ${refundDto.amountPence}p`,
            });
          }
          if (!isShopOwnedPaymentIntentMetadata(metadata)) {
            return "ignored";
          }
        }
        return completeRefundFromWebhook(
          db,
          refundDto,
          options.domainEventMode,
          options.notifications ? { notifications: options.notifications } : undefined,
        );
      }

      const disputeDto = parseDisputeEvent(event);
      if (disputeDto) {
        const [order] = await db
          .select({ id: shopOrder.id })
          .from(shopOrder)
          .where(eq(shopOrder.stripePaymentIntentId, disputeDto.paymentIntentId))
          .limit(1);
        if (!order) {
          const metadata = fetchMetadata ? await fetchMetadata(disputeDto.paymentIntentId) : null;
          const original = await originalSaleOfPayment(db, disputeDto.paymentIntentId, metadata);
          if (original) {
            return alertOriginalSaleMoneyReturned(db, options, {
              originalSaleId: original,
              eventId: disputeDto.eventId,
              paymentIntentId: disputeDto.paymentIntentId,
              detail: `Dispute ${disputeDto.stripeDisputeId}`,
            });
          }
          if (!isShopOwnedPaymentIntentMetadata(metadata)) {
            return "ignored";
          }
        }
        return handleStripeDisputeWebhook(db, disputeDto, {
          domainEventMode: options.domainEventMode,
          ...(options.notifications ? { notifications: options.notifications } : {}),
          ...(options.opsAlertEmail !== undefined ? { opsAlertEmail: options.opsAlertEmail } : {}),
        });
      }

      return "not_applicable";
    },
  };
}

/**
 * The original sold directly in the Shop that a PaymentIntent paid: the one stored on the sale,
 * else the one its Payment Link tagged it with. Null when the payment is not an original's.
 */
async function originalSaleOfPayment(
  db: Database,
  paymentIntentId: string,
  metadata: Stripe.Metadata | null | undefined,
): Promise<string | null> {
  const [sale] = await db
    .select({ id: shopOriginalSale.id })
    .from(shopOriginalSale)
    .where(eq(shopOriginalSale.stripePaymentIntentId, paymentIntentId))
    .limit(1);
  if (sale) return sale.id;
  if (metadata?.app !== ORIGINAL_SALE_PAYMENT_APP) return null;
  return metadata.shop_original_sale_id?.trim() || null;
}

/**
 * Refunds, failed refunds and disputes of an original paid through its Payment Link are not built
 * yet: Books keeps the sale invoiced and paid, and nothing credits it. Until they are, every one
 * is made visible: an ops alert (once per Stripe event, in the notification outbox) and a
 * structured log line, so a person puts the books right by hand (see the monitoring runbook).
 */
async function alertOriginalSaleMoneyReturned(
  db: Database,
  options: { notifications?: ShopNotificationPublisher; opsAlertEmail?: string | null },
  input: { originalSaleId: string; eventId: string; paymentIntentId: string; detail: string },
): Promise<StripeMoneyWebhookOutcome> {
  console.error(
    JSON.stringify({
      msg: SHOP_ORIGINAL_MONEY_RETURNED,
      originalSaleId: input.originalSaleId,
      eventId: input.eventId,
      paymentIntentId: input.paymentIntentId,
      detail: input.detail,
    }),
  );
  const opsEmail = options.opsAlertEmail?.trim();
  if (options.notifications && opsEmail?.includes("@")) {
    const notifications = options.notifications;
    await db.transaction(async (tx) => {
      await notifications.queueCheckoutOpsAlert(tx as Database, {
        idempotencyKey: `original-money-returned:${input.eventId}`,
        opsEmail,
        alertKind: "Shop original refunded or disputed (not credited in Books)",
        orderId: input.originalSaleId,
        detail: `${input.detail} on payment intent ${input.paymentIntentId}. Credit it in Books by hand.`,
      });
    });
  }
  return "processed";
}

/** The log line for a refund or dispute of an original that Books is not told about yet. */
export const SHOP_ORIGINAL_MONEY_RETURNED = "shop_original_money_returned";
