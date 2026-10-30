import type { Database } from "@auction/db";
import { shopGuestCustomer } from "@auction/db/schema";
import {
  GUEST_LEAD_SOURCE_LABEL,
  type GuestLeadSource,
  guestLeadStatus,
  guestOrderSubject,
  normaliseGuestEmail,
} from "@auction/shop-domain";
import { eq, sql } from "drizzle-orm";
import {
  type ShopDomainEventPublisherMode,
  createShopDomainEventPublisher,
} from "../shop-domain-event-publisher.js";

type GuestCustomerRow = typeof shopGuestCustomer.$inferSelect;

/** Publishes the lead as it stands, in the caller's transaction. */
export async function publishGuestLead(
  tx: Database,
  row: GuestCustomerRow,
  mode: ShopDomainEventPublisherMode,
): Promise<void> {
  await createShopDomainEventPublisher(mode).insertInTransaction(tx, {
    aggregateType: "shop_guest_customer",
    aggregateId: row.id,
    eventType: "shop.guest_lead.recorded",
    producer: "shop-api",
    payload: {
      schemaVersion: 1,
      guestCustomerId: row.id,
      leadSubjectId: guestOrderSubject(row.id),
      email: row.email,
      name: row.name,
      status: guestLeadStatus(row),
      source: GUEST_LEAD_SOURCE_LABEL[row.source],
      marketingConsent: row.marketingConsent,
      marketingConsentAt: row.marketingConsentAt?.toISOString() ?? null,
      marketingConsentVersion: row.marketingConsentVersion,
      firstSeenAt: row.firstSeenAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
      paidOrderCount: row.paidOrderCount,
    },
  });
}

/**
 * Counts a paid guest order on the lead, in the payment's transaction. The first paid order turns
 * an abandoned checkout into an ordered lead, so that change is published.
 */
export async function recordGuestOrderPaid(
  tx: Database,
  input: { guestCustomerId: string; paidAt: Date },
  mode: ShopDomainEventPublisherMode,
): Promise<void> {
  const [row] = await tx
    .update(shopGuestCustomer)
    .set({
      paidOrderCount: sql`${shopGuestCustomer.paidOrderCount} + 1`,
      firstPaidAt: sql`coalesce(${shopGuestCustomer.firstPaidAt}, ${input.paidAt})`,
      updatedAt: new Date(),
    })
    .where(eq(shopGuestCustomer.id, input.guestCustomerId))
    .returning();
  if (row?.paidOrderCount === 1) await publishGuestLead(tx, row, mode);
}

/**
 * A guest enquiry makes the sender a lead, or counts on the lead they already are. A new lead is
 * published; later enquiries only update the counts staff see.
 */
export async function recordGuestEnquiryLead(
  tx: Database,
  input: {
    email: string;
    name: string | null;
    phone: string | null;
    source: GuestLeadSource;
    at: Date;
  },
  mode: ShopDomainEventPublisherMode,
): Promise<void> {
  const email = normaliseGuestEmail(input.email);
  const [created] = await tx
    .insert(shopGuestCustomer)
    .values({
      email,
      name: input.name,
      phone: input.phone,
      source: input.source,
      firstSeenAt: input.at,
      lastSeenAt: input.at,
      enquiryCount: 1,
      lastEnquiryAt: input.at,
    })
    .onConflictDoNothing({ target: shopGuestCustomer.email })
    .returning();
  if (created) {
    await publishGuestLead(tx, created, mode);
    return;
  }
  await tx
    .update(shopGuestCustomer)
    .set({
      enquiryCount: sql`${shopGuestCustomer.enquiryCount} + 1`,
      lastEnquiryAt: input.at,
      lastSeenAt: input.at,
      updatedAt: input.at,
      ...(input.name ? { name: input.name } : {}),
      ...(input.phone ? { phone: input.phone } : {}),
    })
    .where(eq(shopGuestCustomer.email, email));
}
