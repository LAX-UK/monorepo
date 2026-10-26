import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopArtworkInterest,
  shopGeneralEnquiry,
  shopOrder,
  shopOrderLine,
  type shopParty,
  shopRefund,
  shopUserProfile,
} from "@auction/db/schema";
import type { AdminClientDetail } from "@auction/shop-contracts";
import { type SQL, and, count, desc, eq, isNotNull, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/** The newest orders and enquiries a client page lists; "View all" opens the rest. */
export const CLIENT_RECENT_LIMIT = 10;

type Party = Pick<typeof shopParty.$inferSelect, "id" | "identitySubjectId">;

type ClientCommerce = {
  email: string | null;
  orders: NonNullable<AdminClientDetail["orders"]>;
  orderCount: number;
  enquiries: NonNullable<AdminClientDetail["enquiries"]>;
  paidToDatePence: number;
};

/**
 * A client's Shop and lax.art activity for their page: the email on their LAX profile, their
 * newest orders and how many they have placed, their newest enquiries, and what they have paid to
 * date (every captured payment, less succeeded refunds; a payment still pending never counts).
 * An order is theirs when it names them as the buyer or was placed from their LAX account.
 */
export async function readClientCommerce(db: Database, party: Party): Promise<ClientCommerce> {
  const subject = party.identitySubjectId;
  const [profile] = subject
    ? await db
        .select({ email: shopUserProfile.email })
        .from(shopUserProfile)
        .where(eq(shopUserProfile.identitySubjectId, subject))
        .limit(1)
    : [];
  const email = profile?.email?.trim() || null;

  const byParty = eq(shopOrder.buyerPartyId, party.id);
  const theirOrders: SQL = subject
    ? (or(byParty, eq(shopOrder.identitySubjectId, subject)) ?? byParty)
    : byParty;

  const [orders, [orderTotals], [refundTotals]] = await Promise.all([
    db
      .select({
        order: shopOrder,
        lineCount: sql<number>`(
          select count(*)::int from ${shopOrderLine} where ${shopOrderLine.orderId} = ${shopOrder.id}
        )`,
      })
      .from(shopOrder)
      .where(theirOrders)
      .orderBy(desc(shopOrder.createdAt), desc(shopOrder.id))
      .limit(CLIENT_RECENT_LIMIT),
    db
      .select({
        orderCount: count(),
        paidPence: sql<number>`coalesce(sum(${shopOrder.totalPence}) filter (where ${shopOrder.paidAt} is not null), 0)::bigint`,
      })
      .from(shopOrder)
      .where(theirOrders),
    db
      .select({ refundedPence: sql<number>`coalesce(sum(${shopRefund.amountPence}), 0)::bigint` })
      .from(shopRefund)
      .innerJoin(shopOrder, eq(shopRefund.orderId, shopOrder.id))
      .where(and(theirOrders, eq(shopRefund.status, "succeeded"), isNotNull(shopOrder.paidAt))),
  ]);

  const enquiries = await readClientEnquiries(db, subject, email);

  return {
    email,
    orders: orders.map(({ order, lineCount }) => ({
      orderId: order.id,
      reference: order.reference,
      status: order.status,
      totalPence: order.totalPence,
      lineCount: Number(lineCount),
      createdAt: order.createdAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
    })),
    orderCount: Number(orderTotals?.orderCount ?? 0),
    enquiries,
    paidToDatePence: Math.max(
      0,
      Number(orderTotals?.paidPence ?? 0) - Number(refundTotals?.refundedPence ?? 0),
    ),
  };
}

/**
 * Enquiries sent from their account, and ones sent as a guest from the email on their profile
 * (people often ask before they sign up). Edition alerts are not enquiries and are left out.
 */
async function readClientEnquiries(
  db: Database,
  subject: string | null,
  email: string | null,
): Promise<ClientCommerce["enquiries"]> {
  if (!subject && !email) return [];
  const fromThem = (subjectColumn: AnyPgColumn, emailColumn: AnyPgColumn) =>
    or(
      subject ? eq(subjectColumn, subject) : undefined,
      email ? sql`lower(${emailColumn}) = lower(${email})` : undefined,
    );
  const [artwork, general] = await Promise.all([
    db
      .select({
        id: shopArtworkInterest.id,
        title: shopArtwork.title,
        status: shopArtworkInterest.status,
        createdAt: shopArtworkInterest.createdAt,
      })
      .from(shopArtworkInterest)
      .innerJoin(shopArtwork, eq(shopArtworkInterest.artworkId, shopArtwork.id))
      .where(
        and(
          eq(shopArtworkInterest.intent, "enquiry"),
          fromThem(shopArtworkInterest.identitySubjectId, shopArtworkInterest.contactEmail),
        ),
      )
      .orderBy(desc(shopArtworkInterest.createdAt))
      .limit(CLIENT_RECENT_LIMIT),
    db
      .select({
        id: shopGeneralEnquiry.id,
        topic: shopGeneralEnquiry.topic,
        status: shopGeneralEnquiry.status,
        createdAt: shopGeneralEnquiry.createdAt,
      })
      .from(shopGeneralEnquiry)
      .where(fromThem(shopGeneralEnquiry.identitySubjectId, shopGeneralEnquiry.contactEmail))
      .orderBy(desc(shopGeneralEnquiry.createdAt))
      .limit(CLIENT_RECENT_LIMIT),
  ]);
  return [
    ...artwork.map((row) => ({
      enquiryId: row.id,
      kind: "artwork" as const,
      subject: row.title,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
    ...general.map((row) => ({
      enquiryId: row.id,
      kind: "general" as const,
      subject: row.topic,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, CLIENT_RECENT_LIMIT);
}
