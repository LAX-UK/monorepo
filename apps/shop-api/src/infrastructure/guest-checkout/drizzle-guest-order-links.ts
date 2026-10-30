import type { Database } from "@auction/db";
import { shopGuestCustomer, shopGuestOrderLink, shopOrder } from "@auction/db/schema";
import { guestOrderLinkState, guestOrderSubject } from "@auction/shop-domain";
import { and, eq } from "drizzle-orm";
import type {
  OrderReader,
  PaymentCheckoutGateway,
} from "../../application/ports/commerce.ports.js";
import type { GuestOrderLinks } from "../../application/ports/guest-checkout.ports.js";
import type { ShopNotificationPublisher } from "../../application/ports/shop-notification.publisher.js";
import { cancelShopCheckoutSession } from "../drizzle-payment-event.processor.js";
import {
  guestOrderLinkUrl,
  hashGuestOrderLinkToken,
  isGuestOrderLinkTokenShape,
  issueGuestOrderLink,
} from "./guest-order-link-token.js";

const EXPIRY_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/London",
});

export function createDrizzleGuestOrderLinks(
  db: Database,
  deps: {
    orders: Pick<OrderReader, "getOrder">;
    notifications: Pick<ShopNotificationPublisher, "queueGuestOrderLink">;
    paymentGateway: PaymentCheckoutGateway;
    storefrontUrl: string;
  },
): GuestOrderLinks {
  const links: GuestOrderLinks = {
    issue(orderId, now) {
      return issueGuestOrderLink(db, orderId, now);
    },

    async resolve(token, now) {
      if (!isGuestOrderLinkTokenShape(token)) return { kind: "not_found" };
      const [link] = await db
        .select({
          orderId: shopGuestOrderLink.orderId,
          expiresAt: shopGuestOrderLink.expiresAt,
          subject: shopOrder.identitySubjectId,
          reference: shopOrder.reference,
          email: shopGuestCustomer.email,
        })
        .from(shopGuestOrderLink)
        .innerJoin(shopOrder, eq(shopOrder.id, shopGuestOrderLink.orderId))
        .innerJoin(shopGuestCustomer, eq(shopGuestCustomer.id, shopOrder.guestCustomerId))
        .where(
          and(
            eq(shopGuestOrderLink.tokenHash, hashGuestOrderLinkToken(token)),
            eq(shopGuestOrderLink.purpose, "order_view"),
          ),
        )
        .limit(1);
      if (!link) return { kind: "not_found" };

      const state = guestOrderLinkState({
        expiresAt: link.expiresAt,
        orderSubject: link.subject,
        now,
      });
      if (state !== "valid") return { kind: state, orderReference: link.reference };

      const order = await deps.orders.getOrder(link.subject, link.orderId);
      if (!order) return { kind: "not_found" };
      await db
        .update(shopGuestOrderLink)
        .set({ lastOpenedAt: now })
        .where(eq(shopGuestOrderLink.tokenHash, hashGuestOrderLinkToken(token)));
      return {
        kind: "valid",
        order,
        subject: link.subject,
        email: link.email,
        expiresAt: link.expiresAt,
      };
    },

    async cancelUnpaid({ token, basketTokenHash, now }) {
      const resolved = await links.resolve(token, now);
      if (resolved.kind !== "valid" || resolved.order.status !== "pending_payment") return;
      await cancelShopCheckoutSession(
        db,
        {
          eventId: `guest-cancel:${resolved.order.orderId}`,
          orderId: resolved.order.orderId,
          source: "buyer",
          restoreTo: { kind: "anonymous", tokenHash: basketTokenHash },
        },
        { paymentGateway: deps.paymentGateway },
      );
    },

    async resend({ email, orderReference, now }) {
      const [order] = await db
        .select({
          id: shopOrder.id,
          reference: shopOrder.reference,
          subject: shopOrder.identitySubjectId,
          guestCustomerId: shopGuestCustomer.id,
          email: shopGuestCustomer.email,
        })
        .from(shopOrder)
        .innerJoin(shopGuestCustomer, eq(shopGuestCustomer.id, shopOrder.guestCustomerId))
        .where(
          and(
            eq(shopOrder.reference, orderReference.trim().toUpperCase()),
            eq(shopGuestCustomer.email, email),
          ),
        )
        .limit(1);
      // Only an order the guest still owns gets a link; a claimed one lives in the LAX account.
      if (!order || order.subject !== guestOrderSubject(order.guestCustomerId)) return;
      await db.transaction(async (tx) => {
        const link = await issueGuestOrderLink(tx as Database, order.id, now);
        await deps.notifications.queueGuestOrderLink(tx, {
          idempotencyKey: `guest-order-link:${order.id}:${now.getTime()}`,
          to: order.email,
          orderReference: order.reference,
          orderUrl: guestOrderLinkUrl(deps.storefrontUrl, link.token),
          expiresOn: EXPIRY_DATE.format(link.expiresAt),
        });
      });
    },
  };
  return links;
}
