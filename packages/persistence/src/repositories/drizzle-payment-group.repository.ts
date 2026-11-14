import type { Database } from "@auction/db";
import {
  deliveryQuote,
  legalEntity,
  lot,
  payment,
  paymentGroup,
  paymentGroupDelivery,
} from "@auction/db/schema";
import type { PaymentGroupStatus } from "@auction/domain";
import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import type {
  ChargeableDeliveryQuote,
  ClaimPaymentGroupInput,
  ClaimPaymentGroupResult,
  IChargeableDeliveryReader,
  IPaySeveralInvoiceFlagsReader,
  IPaymentGroupRepository,
  LockedPaymentGroup,
  LockedPaymentGroupDelivery,
  PaySeveralInvoiceFlags,
  PaymentGroupDelivery,
  PaymentGroupMember,
  PaymentGroupRecord,
} from "../interfaces/payment-group.repository.js";

type GroupRow = typeof paymentGroup.$inferSelect;

function mapGroup(row: GroupRow): PaymentGroupRecord {
  return {
    id: row.id,
    buyerLegalEntityId: row.buyerLegalEntityId,
    createdByUserId: row.createdByUserId,
    status: row.status as PaymentGroupStatus,
    currency: row.currency,
    totalAmount: String(row.totalAmount),
    checkoutRail: row.checkoutRail as PaymentGroupRecord["checkoutRail"],
    stripeCheckoutSessionId: row.stripeCheckoutSessionId,
    stripePaymentIntentId: row.stripePaymentIntentId,
    stripeChargeId: row.stripeChargeId,
    amountReceived: String(row.amountReceived),
    receivedEventAt: row.receivedEventAt,
    createdAt: row.createdAt,
    settledAt: row.settledAt,
  };
}

const MEMBER_COLUMNS = {
  paymentId: payment.id,
  lotId: payment.lotId,
  lotTitle: lot.title,
  lotNumber: lot.lotNumber,
  amount: payment.amount,
  status: payment.status,
  sellerLegalEntityId: payment.sellerLegalEntityId,
};

const LIVE_STATUSES: PaymentGroupStatus[] = ["open", "processing"];
const SETTLED_STATUSES: PaymentGroupStatus[] = ["paid", "cancelled"];

/** Thrown inside the claim transaction to roll it back when not every payment could be taken. */
class ClaimConflict extends Error {}

/** Whole pence of a pounds figure kept as a decimal string, so two figures compare to the penny. */
function samePounds(a: string | null, b: string): boolean {
  return a !== null && Math.round(Number(a) * 100) === Math.round(Number(b) * 100);
}

/** Postgres unique violation: the courier quote is already charged by another payment. */
function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  const causeCode = (err as { cause?: { code?: string } })?.cause?.code;
  return code === "23505" || causeCode === "23505";
}

export class DrizzlePaymentGroupRepository implements IPaymentGroupRepository {
  constructor(private readonly db: Database) {}

  async claim(input: ClaimPaymentGroupInput): Promise<ClaimPaymentGroupResult> {
    const ids = [...new Set(input.paymentIds)];
    if (ids.length === 0) return { kind: "conflict" };
    try {
      const group = await this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(paymentGroup)
          .values({
            buyerLegalEntityId: input.buyerLegalEntityId,
            createdByUserId: input.createdByUserId,
            currency: input.currency,
            totalAmount: input.totalAmount,
            checkoutRail: input.checkoutRail,
            status: "open",
          })
          .returning();
        if (!created) throw new Error("payment_group insert returned no row");
        // Row locks make a racing claim wait, then re-check `payment_group_id is null` against
        // the committed winner, so overlapping claims cannot both take an invoice.
        const taken = await tx
          .update(payment)
          .set({ paymentGroupId: created.id })
          .where(
            and(
              inArray(payment.id, ids),
              eq(payment.buyerLegalEntityId, input.buyerLegalEntityId),
              eq(payment.status, "pending"),
              isNull(payment.paymentGroupId),
            ),
          )
          .returning({ id: payment.id });
        if (taken.length !== ids.length) throw new ClaimConflict();
        await this.takeDeliveries(tx, created.id, input);
        return mapGroup(created);
      });
      return { kind: "claimed", group };
    } catch (err) {
      if (err instanceof ClaimConflict || isUniqueViolation(err)) return { kind: "conflict" };
      throw err;
    }
  }

  /**
   * Takes the accepted quotes into the group. The quotes are locked first, so a quote withdrawn
   * or re-priced meanwhile is seen as it now stands; the unique index stops a second payment.
   */
  private async takeDeliveries(
    tx: Database,
    groupId: string,
    input: ClaimPaymentGroupInput,
  ): Promise<void> {
    if (input.deliveries.length === 0) return;
    const ids = input.deliveries.map((d) => d.quoteId);
    if (new Set(ids).size !== ids.length) throw new ClaimConflict();
    const quotes = await tx
      .select({
        id: deliveryQuote.id,
        lotId: deliveryQuote.lotId,
        buyerLegalEntityId: deliveryQuote.buyerLegalEntityId,
        status: deliveryQuote.status,
        currency: deliveryQuote.currency,
        amount: deliveryQuote.amount,
      })
      .from(deliveryQuote)
      .where(inArray(deliveryQuote.id, ids))
      .for("update");
    const byId = new Map(quotes.map((q) => [q.id, q]));
    for (const wanted of input.deliveries) {
      const quote = byId.get(wanted.quoteId);
      const same =
        quote !== undefined &&
        quote.status === "accepted" &&
        quote.buyerLegalEntityId === input.buyerLegalEntityId &&
        quote.lotId === wanted.lotId &&
        quote.currency === input.currency &&
        samePounds(quote.amount, wanted.amount);
      if (!same) throw new ClaimConflict();
    }
    await tx.insert(paymentGroupDelivery).values(
      input.deliveries.map((d) => ({
        paymentGroupId: groupId,
        deliveryQuoteId: d.quoteId,
        lotId: d.lotId,
        amount: d.amount,
      })),
    );
  }

  async findById(id: string): Promise<PaymentGroupRecord | null> {
    const [row] = await this.db.select().from(paymentGroup).where(eq(paymentGroup.id, id));
    return row ? mapGroup(row) : null;
  }

  async findByStripeRefs(refs: {
    chargeId?: string | null;
    paymentIntentId?: string | null;
  }): Promise<PaymentGroupRecord | null> {
    const conditions = [
      refs.chargeId ? eq(paymentGroup.stripeChargeId, refs.chargeId) : undefined,
      refs.paymentIntentId
        ? eq(paymentGroup.stripePaymentIntentId, refs.paymentIntentId)
        : undefined,
    ].filter((c) => c !== undefined);
    if (conditions.length === 0) return null;
    const [row] = await this.db
      .select()
      .from(paymentGroup)
      .where(or(...conditions))
      .limit(1);
    return row ? mapGroup(row) : null;
  }

  async listMembers(groupId: string): Promise<PaymentGroupMember[]> {
    return this.membersQuery(this.db, groupId);
  }

  async listDeliveries(groupId: string): Promise<PaymentGroupDelivery[]> {
    const rows = await this.deliveriesQuery(this.db, groupId);
    return rows.map(({ refundedPence: _refundedPence, ...delivery }) => delivery);
  }

  async findBankTransferGroupsForCustomer(
    stripeCustomerId: string,
    since: Date,
  ): Promise<PaymentGroupRecord[]> {
    const rows = await this.db
      .select({ group: paymentGroup })
      .from(paymentGroup)
      .innerJoin(legalEntity, eq(legalEntity.id, paymentGroup.buyerLegalEntityId))
      .where(
        and(
          eq(legalEntity.stripeCustomerId, stripeCustomerId),
          eq(paymentGroup.checkoutRail, "gb_bank_transfer"),
          inArray(paymentGroup.status, ["open", "processing", "paid"]),
          gte(paymentGroup.createdAt, since),
        ),
      )
      .orderBy(desc(paymentGroup.createdAt))
      .limit(5);
    return rows.map((row) => mapGroup(row.group));
  }

  async findLiveByPaymentIds(paymentIds: readonly string[]): Promise<PaymentGroupRecord[]> {
    if (paymentIds.length === 0) return [];
    const rows = await this.db
      .selectDistinct({ group: paymentGroup })
      .from(payment)
      .innerJoin(paymentGroup, eq(paymentGroup.id, payment.paymentGroupId))
      .where(
        and(inArray(payment.id, [...paymentIds]), inArray(paymentGroup.status, LIVE_STATUSES)),
      );
    return rows.map((r) => mapGroup(r.group));
  }

  async recordReceivedInTransaction(
    tx: Database,
    groupId: string,
    received: { amount: string; eventAt: Date },
  ): Promise<boolean> {
    // One statement decides everything: a late (older) event changes nothing, the figure only
    // goes up, and it is capped at the total, so replays and reordering cannot lower or inflate it.
    const rows = await tx
      .update(paymentGroup)
      .set({
        amountReceived: sql`least(greatest(${paymentGroup.amountReceived}, ${received.amount}::numeric), ${paymentGroup.totalAmount})`,
        receivedEventAt: received.eventAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentGroup.id, groupId),
          inArray(paymentGroup.status, LIVE_STATUSES),
          or(
            isNull(paymentGroup.receivedEventAt),
            lte(paymentGroup.receivedEventAt, received.eventAt),
          ),
        ),
      )
      .returning({ id: paymentGroup.id });
    return rows.length > 0;
  }

  async recordCheckout(
    groupId: string,
    checkout: { sessionId: string; paymentIntentId: string | null },
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const updated = await tx
        .update(paymentGroup)
        .set({
          stripeCheckoutSessionId: checkout.sessionId,
          ...(checkout.paymentIntentId ? { stripePaymentIntentId: checkout.paymentIntentId } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(paymentGroup.id, groupId), inArray(paymentGroup.status, LIVE_STATUSES)))
        .returning({ id: paymentGroup.id });
      if (updated.length === 0) return false;
      if (checkout.paymentIntentId) {
        await tx
          .update(payment)
          .set({ stripePaymentIntentId: checkout.paymentIntentId })
          .where(eq(payment.paymentGroupId, groupId));
      }
      return true;
    });
  }

  async lockInTransaction(tx: Database, groupId: string): Promise<LockedPaymentGroup | null> {
    const [row] = await tx
      .select()
      .from(paymentGroup)
      .where(eq(paymentGroup.id, groupId))
      .for("update");
    if (!row) return null;
    await tx
      .select({ id: payment.id })
      .from(payment)
      .where(eq(payment.paymentGroupId, groupId))
      .orderBy(asc(payment.id))
      .for("update");
    return {
      group: mapGroup(row),
      members: await this.membersQuery(tx, groupId),
      deliveries: await this.deliveriesQuery(tx, groupId),
      refundUnattributedPence: row.refundUnattributedPence,
    };
  }

  async raiseDeliveryRefundedInTransaction(
    tx: Database,
    groupId: string,
    quoteId: string,
    refundedPence: number,
  ): Promise<boolean> {
    const rows = await tx
      .update(paymentGroupDelivery)
      .set({ refundedPence })
      .where(
        and(
          eq(paymentGroupDelivery.paymentGroupId, groupId),
          eq(paymentGroupDelivery.deliveryQuoteId, quoteId),
          lt(paymentGroupDelivery.refundedPence, refundedPence),
        ),
      )
      .returning({ id: paymentGroupDelivery.id });
    return rows.length > 0;
  }

  async raiseUnattributedRefundInTransaction(
    tx: Database,
    groupId: string,
    unattributedPence: number,
  ): Promise<boolean> {
    const rows = await tx
      .update(paymentGroup)
      .set({ refundUnattributedPence: unattributedPence })
      .where(
        and(
          eq(paymentGroup.id, groupId),
          lt(paymentGroup.refundUnattributedPence, unattributedPence),
        ),
      )
      .returning({ id: paymentGroup.id });
    return rows.length > 0;
  }

  async listChargedGroupsWithRefunds(input: {
    afterId: string | null;
    limit: number;
  }): Promise<{ id: string; stripeChargeId: string }[]> {
    const limit = Math.max(1, Math.min(Math.trunc(input.limit), 500));
    const rows = await this.db
      .select({ id: paymentGroup.id, stripeChargeId: paymentGroup.stripeChargeId })
      .from(paymentGroup)
      .where(
        and(
          sql`${paymentGroup.stripeChargeId} IS NOT NULL`,
          input.afterId ? gt(paymentGroup.id, input.afterId) : undefined,
          or(
            gt(paymentGroup.refundUnattributedPence, 0),
            sql`EXISTS (SELECT 1 FROM "payment_group_delivery" d WHERE d."payment_group_id" = ${paymentGroup.id} AND d."refunded_pence" > 0)`,
            sql`EXISTS (SELECT 1 FROM "payment" p JOIN "payment_refund" r ON r."payment_id" = p."id" WHERE p."payment_group_id" = ${paymentGroup.id})`,
            sql`EXISTS (SELECT 1 FROM "payment" p JOIN "payout_line" l ON l."payment_id" = p."id" WHERE p."payment_group_id" = ${paymentGroup.id} AND l."kind" = 'refund')`,
          ),
        ),
      )
      .orderBy(asc(paymentGroup.id))
      .limit(limit);
    return rows.flatMap((r) =>
      r.stripeChargeId ? [{ id: r.id, stripeChargeId: r.stripeChargeId }] : [],
    );
  }

  async lowerDeliveryRefundedInTransaction(
    tx: Database,
    groupId: string,
    quoteId: string,
    refundedPence: number,
  ): Promise<boolean> {
    if (!Number.isSafeInteger(refundedPence) || refundedPence < 0) return false;
    const rows = await tx
      .update(paymentGroupDelivery)
      .set({ refundedPence })
      .where(
        and(
          eq(paymentGroupDelivery.paymentGroupId, groupId),
          eq(paymentGroupDelivery.deliveryQuoteId, quoteId),
          gt(paymentGroupDelivery.refundedPence, refundedPence),
        ),
      )
      .returning({ id: paymentGroupDelivery.id });
    return rows.length > 0;
  }

  async lowerUnattributedRefundInTransaction(
    tx: Database,
    groupId: string,
    unattributedPence: number,
  ): Promise<boolean> {
    if (!Number.isSafeInteger(unattributedPence) || unattributedPence < 0) return false;
    const rows = await tx
      .update(paymentGroup)
      .set({ refundUnattributedPence: unattributedPence })
      .where(
        and(
          eq(paymentGroup.id, groupId),
          gt(paymentGroup.refundUnattributedPence, unattributedPence),
        ),
      )
      .returning({ id: paymentGroup.id });
    return rows.length > 0;
  }

  async transitionInTransaction(
    tx: Database,
    groupId: string,
    from: readonly PaymentGroupStatus[],
    to: PaymentGroupStatus,
    opts: { stripeChargeId?: string | null; stripePaymentIntentId?: string | null; at?: Date } = {},
  ): Promise<boolean> {
    const now = opts.at ?? new Date();
    const rows = await tx
      .update(paymentGroup)
      .set({
        status: to,
        updatedAt: now,
        ...(SETTLED_STATUSES.includes(to) ? { settledAt: now } : {}),
        ...(opts.stripeChargeId ? { stripeChargeId: opts.stripeChargeId } : {}),
        ...(opts.stripePaymentIntentId
          ? { stripePaymentIntentId: opts.stripePaymentIntentId }
          : {}),
      })
      .where(and(eq(paymentGroup.id, groupId), inArray(paymentGroup.status, [...from])))
      .returning({ id: paymentGroup.id });
    return rows.length > 0;
  }

  async releaseMembersInTransaction(tx: Database, groupId: string): Promise<string[]> {
    const rows = await tx
      .update(payment)
      .set({ paymentGroupId: null, status: "pending" })
      .where(
        and(
          eq(payment.paymentGroupId, groupId),
          inArray(payment.status, ["pending", "authorized"]),
        ),
      )
      .returning({ id: payment.id });
    // The quotes are free again only once the group has handed everything back.
    await tx.delete(paymentGroupDelivery).where(eq(paymentGroupDelivery.paymentGroupId, groupId));
    return rows.map((r) => r.id);
  }

  private async deliveriesQuery(
    conn: Database,
    groupId: string,
  ): Promise<LockedPaymentGroupDelivery[]> {
    const rows = await conn
      .select({
        quoteId: paymentGroupDelivery.deliveryQuoteId,
        lotId: paymentGroupDelivery.lotId,
        amount: paymentGroupDelivery.amount,
        refundedPence: paymentGroupDelivery.refundedPence,
      })
      .from(paymentGroupDelivery)
      .where(eq(paymentGroupDelivery.paymentGroupId, groupId))
      .orderBy(asc(paymentGroupDelivery.createdAt), asc(paymentGroupDelivery.id));
    return rows.map((r) => ({ ...r, amount: String(r.amount) }));
  }

  private async membersQuery(conn: Database, groupId: string): Promise<PaymentGroupMember[]> {
    const rows = await conn
      .select(MEMBER_COLUMNS)
      .from(payment)
      .innerJoin(lot, eq(lot.id, payment.lotId))
      .where(eq(payment.paymentGroupId, groupId))
      .orderBy(asc(payment.createdAt), asc(payment.id));
    return rows.map((r) => ({ ...r, amount: String(r.amount) }));
  }
}

export class DrizzleChargeableDeliveryReader implements IChargeableDeliveryReader {
  constructor(private readonly db: Database) {}

  async acceptedFor(
    buyerLegalEntityId: string,
    lotIds: readonly string[],
  ): Promise<ChargeableDeliveryQuote[]> {
    if (lotIds.length === 0) return [];
    const rows = await this.db
      .select({
        quoteId: deliveryQuote.id,
        lotId: deliveryQuote.lotId,
        amount: deliveryQuote.amount,
        destination: deliveryQuote.destination,
        quoteNote: deliveryQuote.quoteNote,
      })
      .from(deliveryQuote)
      .leftJoin(paymentGroupDelivery, eq(paymentGroupDelivery.deliveryQuoteId, deliveryQuote.id))
      .where(
        and(
          eq(deliveryQuote.buyerLegalEntityId, buyerLegalEntityId),
          inArray(deliveryQuote.lotId, [...lotIds]),
          eq(deliveryQuote.status, "accepted"),
          isNull(paymentGroupDelivery.id),
        ),
      )
      .orderBy(asc(deliveryQuote.decidedAt), asc(deliveryQuote.id));
    return rows.flatMap((r) => (r.amount === null ? [] : [{ ...r, amount: String(r.amount) }]));
  }
}

export class DrizzlePaySeveralInvoiceFlagsReader implements IPaySeveralInvoiceFlagsReader {
  constructor(private readonly db: Database) {}

  async flagsFor(paymentIds: readonly string[]): Promise<Map<string, PaySeveralInvoiceFlags>> {
    if (paymentIds.length === 0) return new Map();
    const rows = await this.db
      .select({
        paymentId: payment.id,
        sellerStatus: legalEntity.status,
        groupId: paymentGroup.id,
        groupStatus: paymentGroup.status,
        groupRail: paymentGroup.checkoutRail,
        groupSession: paymentGroup.stripeCheckoutSessionId,
        groupTotal: paymentGroup.totalAmount,
        groupReceived: paymentGroup.amountReceived,
        groupMembers: sql<number>`(select count(*)::int from payment member where member.payment_group_id = ${paymentGroup.id})`,
      })
      .from(payment)
      .innerJoin(legalEntity, eq(legalEntity.id, payment.sellerLegalEntityId))
      .leftJoin(paymentGroup, eq(paymentGroup.id, payment.paymentGroupId))
      .where(inArray(payment.id, [...paymentIds]));
    return new Map(
      rows.map((r) => {
        const live =
          r.groupId !== null &&
          r.groupStatus !== null &&
          LIVE_STATUSES.includes(r.groupStatus as PaymentGroupStatus);
        return [
          r.paymentId,
          {
            heldForReview: r.sellerStatus === "archived",
            inPaymentInProgress: live,
            group:
              live && r.groupId !== null
                ? {
                    id: r.groupId,
                    status: r.groupStatus as "open" | "processing",
                    checkoutRail: r.groupRail as PaymentGroupRecord["checkoutRail"],
                    stripeCheckoutSessionId: r.groupSession,
                    totalAmount: String(r.groupTotal),
                    amountReceived: String(r.groupReceived),
                    memberCount: Number(r.groupMembers),
                  }
                : null,
          },
        ];
      }),
    );
  }
}
