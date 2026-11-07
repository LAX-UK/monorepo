import type { Database } from "@auction/db";
import { legalEntity, lot, payment, paymentGroup } from "@auction/db/schema";
import type { PaymentGroupStatus } from "@auction/domain";
import { and, asc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type {
  ClaimPaymentGroupInput,
  ClaimPaymentGroupResult,
  IPaySeveralInvoiceFlagsReader,
  IPaymentGroupRepository,
  LockedPaymentGroup,
  PaySeveralInvoiceFlags,
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
        return mapGroup(created);
      });
      return { kind: "claimed", group };
    } catch (err) {
      if (err instanceof ClaimConflict) return { kind: "conflict" };
      throw err;
    }
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
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(paymentGroup)
        .set({
          stripeCheckoutSessionId: checkout.sessionId,
          ...(checkout.paymentIntentId ? { stripePaymentIntentId: checkout.paymentIntentId } : {}),
          updatedAt: new Date(),
        })
        .where(eq(paymentGroup.id, groupId));
      if (checkout.paymentIntentId) {
        await tx
          .update(payment)
          .set({ stripePaymentIntentId: checkout.paymentIntentId })
          .where(eq(payment.paymentGroupId, groupId));
      }
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
      .for("update");
    return { group: mapGroup(row), members: await this.membersQuery(tx, groupId) };
  }

  async transitionInTransaction(
    tx: Database,
    groupId: string,
    from: readonly PaymentGroupStatus[],
    to: PaymentGroupStatus,
    opts: { stripeChargeId?: string | null; stripePaymentIntentId?: string | null } = {},
  ): Promise<boolean> {
    const now = new Date();
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
    return rows.map((r) => r.id);
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
                  }
                : null,
          },
        ];
      }),
    );
  }
}
