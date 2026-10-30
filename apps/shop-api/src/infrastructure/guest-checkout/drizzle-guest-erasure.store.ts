import type { Database } from "@auction/db";
import {
  shopAdminAudit,
  shopArtworkInterest,
  shopFulfilment,
  shopGeneralEnquiry,
  shopGuestCustomer,
  shopGuestOrderLink,
  shopOrder,
  shopParty,
} from "@auction/db/schema";
import { ERASED_ENQUIRY_MESSAGE, erasedGuestEmail, guestOrderSubject } from "@auction/shop-domain";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type {
  GuestErasureCounts,
  GuestErasureSnapshot,
  GuestErasureStore,
} from "../../application/ports/guest-erasure.store.js";
import {
  type ShopDomainEventPublisherMode,
  createShopDomainEventPublisher,
} from "../shop-domain-event-publisher.js";

/** What a guest's party is called once erased; the party stays because orders point at it. */
const ERASED_PARTY_NAME = "Erased guest";

async function readSnapshot(
  db: Database,
  guestCustomerId: string,
  lock: boolean,
): Promise<GuestErasureSnapshot | null> {
  const query = db
    .select({
      id: shopGuestCustomer.id,
      email: shopGuestCustomer.email,
      erasedAt: shopGuestCustomer.erasedAt,
      claimedAt: shopGuestCustomer.claimedAt,
    })
    .from(shopGuestCustomer)
    .where(eq(shopGuestCustomer.id, guestCustomerId))
    .limit(1);
  const [guest] = lock ? await query.for("update") : await query;
  if (!guest) return null;
  const orders = await db
    .select({
      reference: shopOrder.reference,
      status: shopOrder.status,
      fulfilmentStatus: shopFulfilment.status,
      cancellationEndsAt: shopOrder.refundPeriodEndsAt,
      // Each of these still needs to reach the guest, so erasure waits for it.
      openRefund: sql<boolean>`EXISTS (
        SELECT 1 FROM shop_refund r WHERE r.order_id = ${shopOrder.id} AND r.status = 'pending'
      )`,
      openCase: sql<boolean>`(
        EXISTS (SELECT 1 FROM shop_dispute d WHERE d.order_id = ${shopOrder.id} AND d.status = 'opened')
        OR EXISTS (
          SELECT 1 FROM shop_return rt JOIN shop_order_line l ON l.id = rt.order_line_id
          WHERE l.order_id = ${shopOrder.id} AND rt.status IN ('requested', 'in_transit')
        )
        OR EXISTS (
          SELECT 1 FROM shop_general_enquiry g
          WHERE g.topic = 'order_problem' AND g.context_slug = ${shopOrder.reference}
            AND g.status <> 'closed'
        )
      )`,
    })
    .from(shopOrder)
    .leftJoin(shopFulfilment, eq(shopFulfilment.orderId, shopOrder.id))
    .where(eq(shopOrder.identitySubjectId, guestOrderSubject(guest.id)));
  return {
    guestCustomerId: guest.id,
    email: guest.email,
    erasedAt: guest.erasedAt,
    claimedAt: guest.claimedAt,
    orders: orders.map((order) => ({
      reference: order.reference,
      status: order.status,
      fulfilmentStatus: order.fulfilmentStatus ?? null,
      openRefund: Boolean(order.openRefund),
      openCase: Boolean(order.openCase),
      cancellationEndsAt: order.cancellationEndsAt,
    })),
  };
}

/**
 * Clears what the invoice does not need from the guest's orders (the phone) and marks them
 * erased. The name and address the VAT invoice shows stay until the retention purge.
 */
async function redactOrders(tx: Database, guestCustomerId: string, now: Date) {
  const orders = await tx
    .update(shopOrder)
    .set({
      deliveryPhone: null,
      personalDataErasedAt: now,
      updatedAt: now,
    })
    .where(eq(shopOrder.identitySubjectId, guestOrderSubject(guestCustomerId)))
    .returning({ id: shopOrder.id });
  const orderIds = orders.map((order) => order.id);
  const links =
    orderIds.length === 0
      ? []
      : await tx
          .delete(shopGuestOrderLink)
          .where(inArray(shopGuestOrderLink.orderId, orderIds))
          .returning({ tokenHash: shopGuestOrderLink.tokenHash });
  await tx
    .update(shopParty)
    .set({ displayName: ERASED_PARTY_NAME })
    .where(eq(shopParty.identitySubjectId, guestOrderSubject(guestCustomerId)));
  return { orders: orderIds.length, links: links.length };
}

/**
 * Clears what the guest wrote and how to reach them from the enquiries and alerts they sent
 * without an account. The rows stay so staff history and counts hold; the placeholder email keeps
 * the "account or contact" rule and can never receive mail.
 */
async function redactEnquiries(tx: Database, email: string, placeholder: string, now: Date) {
  const byEmail = (column: AnyPgColumn) => sql`lower(${column}) = ${email}`;
  const artwork = await tx
    .update(shopArtworkInterest)
    .set({
      contactEmail: placeholder,
      contactName: null,
      contactPhone: null,
      message: sql`CASE WHEN ${shopArtworkInterest.intent} = 'enquiry' THEN ${ERASED_ENQUIRY_MESSAGE} ELSE NULL END`,
      cancelledAt: sql`CASE WHEN ${shopArtworkInterest.intent} = 'notify_me' THEN coalesce(${shopArtworkInterest.cancelledAt}, ${now}) ELSE NULL END`,
      unsubscribeTokenHash: null,
      updatedAt: now,
    })
    .where(
      and(isNull(shopArtworkInterest.identitySubjectId), byEmail(shopArtworkInterest.contactEmail)),
    )
    .returning({ intent: shopArtworkInterest.intent });
  const general = await tx
    .update(shopGeneralEnquiry)
    .set({
      contactEmail: placeholder,
      contactName: null,
      phone: null,
      message: ERASED_ENQUIRY_MESSAGE,
      updatedAt: now,
    })
    .where(
      and(isNull(shopGeneralEnquiry.identitySubjectId), byEmail(shopGeneralEnquiry.contactEmail)),
    )
    .returning({ id: shopGeneralEnquiry.id });
  return artwork.filter((row) => row.intent === "enquiry").length + general.length;
}

export function createDrizzleGuestErasureStore(
  db: Database,
  options: { domainEventMode: ShopDomainEventPublisherMode },
): GuestErasureStore {
  const events = createShopDomainEventPublisher(options.domainEventMode);
  return {
    read: (guestCustomerId) => readSnapshot(db, guestCustomerId, false),

    async withLockedGuest(guestCustomerId, work) {
      return db.transaction(async (rawTx) => {
        const tx = rawTx as Database;
        const guest = await readSnapshot(tx, guestCustomerId, true);
        if (!guest) return null;
        return work(guest, async ({ actorSubjectId, reason, now }) => {
          const placeholder = erasedGuestEmail(guest.guestCustomerId);
          const orderCounts = await redactOrders(tx, guest.guestCustomerId, now);
          const enquiries = await redactEnquiries(tx, guest.email, placeholder, now);
          await tx
            .update(shopGuestCustomer)
            .set({
              email: placeholder,
              name: null,
              phone: null,
              marketingConsent: false,
              marketingConsentAt: null,
              marketingConsentVersion: null,
              erasedAt: now,
              erasedBySubjectId: actorSubjectId,
              updatedAt: now,
            })
            .where(eq(shopGuestCustomer.id, guest.guestCustomerId));
          const counts: GuestErasureCounts = { ...orderCounts, enquiries };
          // The audit entry says who, when and why, and what changed; it holds no personal data.
          await tx.insert(shopAdminAudit).values({
            actorSubjectId,
            capability: "lead.erase",
            action: "erase_guest_personal_data",
            targetType: "shop_guest_customer",
            targetId: guest.guestCustomerId,
            afterJson: JSON.stringify({ reason, ...counts }),
          });
          await events.insertInTransaction(tx, {
            aggregateType: "shop_guest_customer",
            aggregateId: guest.guestCustomerId,
            eventType: "shop.guest_lead.erased",
            producer: "shop-api",
            payload: {
              schemaVersion: 1,
              guestCustomerId: guest.guestCustomerId,
              leadSubjectId: guestOrderSubject(guest.guestCustomerId),
              erasedAt: now.toISOString(),
            },
          });
          return counts;
        });
      });
    },
  };
}
