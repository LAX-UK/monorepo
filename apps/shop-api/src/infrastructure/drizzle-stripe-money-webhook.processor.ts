import type { Database } from "@auction/db";
import { shopOrder } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import type { ShopNotificationPublisher } from "../application/ports/shop-notification.publisher.js";
import type { StripeMoneyWebhookOutcome } from "../application/ports/stripe-money-webhook.types.js";
import { completeRefundFromWebhook } from "./handlers/webhooks/complete-refund.handler.js";
import { handleStripeDisputeWebhook } from "./handlers/webhooks/stripe-dispute.handler.js";
import { completeOriginalSaleFromStripeInvoice } from "./phase/drizzle-original-sale.writer.js";
import type { ShopDomainEventPublisherMode } from "./shop-domain-event-publisher.js";
import {
  isShopOwnedPaymentIntentMetadata,
  parseDisputeEvent,
  parseStripeRefundEvent,
} from "./stripe-webhook.dto.js";

export function createDrizzleStripeMoneyWebhookProcessor(
  db: Database,
  options: {
    domainEventMode: ShopDomainEventPublisherMode;
    notifications?: ShopNotificationPublisher;
    opsAlertEmail?: string | null;
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
        });
        if (outcome === "ignored") {
          return "ignored";
        }
        return "processed";
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
