import type { Database } from "@auction/db";
import { isGuestOrderSubject } from "@auction/shop-domain";
import { countryNameOf } from "../../application/country-name.js";
import type {
  DeliveryQuoteOrderReleaser,
  DeliveryQuoteStaffMail,
  DeliveryQuoteStaffTx,
  DeliveryQuoteStaffUnitOfWork,
} from "../../application/delivery-quote-staff/delivery-quote-staff.ports.js";
import type { ShopNotificationPublisher } from "../../application/ports/shop-notification.publisher.js";
import type { ShopUnitOfWorkFactory } from "../../application/ports/shop-unit-of-work.js";
import { cancelShopCheckoutSession } from "../drizzle-payment-event.processor.js";
import { shopPhaseDbSession } from "../drizzle-shop-transaction-effects.js";
import {
  guestOrderLinkUrl,
  issueGuestOrderLink,
} from "../guest-checkout/guest-order-link-token.js";
import { createDrizzleDeliveryQuoteStaffStore } from "./drizzle-delivery-quote-staff.store.js";

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const pounds = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);

/**
 * The buyer's emails for a quote: the price and how to pay, or why the gallery cannot deliver.
 * An account opens its order from Your orders; a guest gets a link that opens it without one.
 */
function createQuoteMail(
  tx: Database,
  deps: { notifications: ShopNotificationPublisher; storefrontUrl: string },
): DeliveryQuoteStaffMail {
  const orderUrl = async (orderId: string, subject: string) =>
    isGuestOrderSubject(subject)
      ? guestOrderLinkUrl(
          deps.storefrontUrl,
          (await issueGuestOrderLink(tx, orderId, new Date())).token,
        )
      : `${deps.storefrontUrl.replace(/\/$/, "")}/orders/${orderId}`;

  return {
    async quoteReady(input) {
      const { row } = input.quote;
      await deps.notifications.queueDeliveryQuoteReady(tx, {
        idempotencyKey: `delivery-quote-ready:${row.id}:${input.holdUntil.getTime()}`,
        identitySubjectId: input.quote.identitySubjectId,
        fallbackEmail: input.quote.guestEmail,
        orderReference: row.orderReference,
        countryName: countryNameOf(row.country),
        carrier: input.carrier,
        service: input.service,
        leadTimeNote: input.leadTimeNote,
        deliveryPrice: pounds(input.pricePence),
        totalPrice: pounds(row.beforeDeliveryPence + input.pricePence),
        validUntilOn: dayFormat.format(input.holdUntil),
        orderUrl: await orderUrl(row.orderId, input.quote.identitySubjectId),
      });
    },
    async quoteDeclined(input) {
      const { row } = input.quote;
      await deps.notifications.queueDeliveryQuoteDeclined(tx, {
        idempotencyKey: `delivery-quote-declined:${row.id}`,
        identitySubjectId: input.quote.identitySubjectId,
        fallbackEmail: input.quote.guestEmail,
        orderReference: row.orderReference,
        countryName: countryNameOf(row.country),
        note: input.note,
        collectionUrl: `${deps.storefrontUrl.replace(/\/$/, "")}/delivery`,
      });
    },
  };
}

/** Binds a quote's store, mail, audit and commands to one transaction. */
export function createDrizzleDeliveryQuoteStaffUnitOfWork(
  uow: ShopUnitOfWorkFactory,
  deps: { notifications: ShopNotificationPublisher; storefrontUrl: string },
): DeliveryQuoteStaffUnitOfWork {
  return {
    run: (fn) =>
      uow.run((effects) => {
        const session = shopPhaseDbSession(effects);
        const tx: DeliveryQuoteStaffTx = {
          store: createDrizzleDeliveryQuoteStaffStore(session),
          mail: createQuoteMail(session, deps),
          audit: effects.audit,
          commands: effects.commands,
        };
        return fn(tx);
      }),
  };
}

/** Turns the order of a request staff declined into a cancelled one: prints released, basket back. */
export function createDrizzleDeliveryQuoteOrderReleaser(db: Database): DeliveryQuoteOrderReleaser {
  return {
    async release(orderId, quoteId) {
      await cancelShopCheckoutSession(db, {
        eventId: `delivery-quote-decline:${quoteId}`,
        orderId,
        source: "staff",
      });
    },
  };
}
