import type { Database } from "@auction/db";
import {
  payout,
  payoutLine,
  privateSaleDeal,
  privateSaleDealParty,
  privateSaleDealPayment,
} from "@auction/db/schema";
import type {
  PayoutLine,
  PrivateSaleDealPayment,
  PrivateSalePaymentRail,
  PrivateSalePaymentStatus,
  PrivateSalePayoutDeal,
} from "@auction/types";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type {
  ClaimDealPaymentResult,
  IPrivateSaleDealFinanceStore,
  IPrivateSaleDealPaymentReader,
  IPrivateSaleDealPaymentWriter,
  IPrivateSaleDealPayoutStore,
  NewPrivateSaleDealPayment,
} from "../interfaces/private-sale-deal-payment.repository.js";

type PaymentRow = typeof privateSaleDealPayment.$inferSelect;

const LIVE: PrivateSalePaymentStatus[] = ["open", "processing", "paid"];
/** Agreed and not yet paid out: what the buyer is committed to elsewhere. */
const OPEN_EXPOSURE_STAGES = ["agreed", "cleared", "invoiced", "paid", "released"];

function mapPayment(row: PaymentRow): PrivateSaleDealPayment {
  return {
    id: row.id,
    dealId: row.dealId,
    buyerLegalEntityId: row.buyerLegalEntityId,
    createdByUserId: row.createdByUserId,
    status: row.status as PrivateSalePaymentStatus,
    rail: row.rail as PrivateSalePaymentRail,
    currency: "GBP",
    amountMinor: row.amountMinor,
    stripeCheckoutSessionId: row.stripeCheckoutSessionId,
    stripePaymentIntentId: row.stripePaymentIntentId,
    stripeChargeId: row.stripeChargeId,
    recordedByUserId: row.recordedByUserId,
    bankReference: row.bankReference,
    refundedMinor: row.refundedMinor,
    stripeRefundId: row.stripeRefundId,
    paidAt: row.paidAt,
    refundedAt: row.refundedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** The buyer's payment for a private sale deal. */
export class DrizzlePrivateSaleDealPaymentRepository
  implements IPrivateSaleDealPaymentReader, IPrivateSaleDealPaymentWriter
{
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<PrivateSaleDealPayment | null> {
    return this.one(eq(privateSaleDealPayment.id, id));
  }

  async findByIdForUpdate(id: string): Promise<PrivateSaleDealPayment | null> {
    const [row] = await this.db
      .select()
      .from(privateSaleDealPayment)
      .where(eq(privateSaleDealPayment.id, id))
      .for("update");
    return row ? mapPayment(row) : null;
  }

  async findLiveForDeal(dealId: string): Promise<PrivateSaleDealPayment | null> {
    return this.one(
      and(eq(privateSaleDealPayment.dealId, dealId), inArray(privateSaleDealPayment.status, LIVE)),
    );
  }

  async findByPaymentIntentId(paymentIntentId: string): Promise<PrivateSaleDealPayment | null> {
    return this.one(eq(privateSaleDealPayment.stripePaymentIntentId, paymentIntentId));
  }

  async findByChargeId(chargeId: string): Promise<PrivateSaleDealPayment | null> {
    return this.one(eq(privateSaleDealPayment.stripeChargeId, chargeId));
  }

  async listForDeal(dealId: string): Promise<PrivateSaleDealPayment[]> {
    const rows = await this.db
      .select()
      .from(privateSaleDealPayment)
      .where(eq(privateSaleDealPayment.dealId, dealId))
      .orderBy(desc(privateSaleDealPayment.createdAt), desc(privateSaleDealPayment.id));
    return rows.map(mapPayment);
  }

  async claim(input: NewPrivateSaleDealPayment): Promise<ClaimDealPaymentResult> {
    // A deal has at most one live payment; losing that race hands back the one that won.
    const [row] = await this.db
      .insert(privateSaleDealPayment)
      .values({
        dealId: input.dealId,
        buyerLegalEntityId: input.buyerLegalEntityId,
        createdByUserId: input.createdByUserId,
        rail: input.rail,
        amountMinor: input.amountMinor,
      })
      .onConflictDoNothing()
      .returning();
    if (row) return { kind: "created", payment: mapPayment(row) };
    const existing = await this.findLiveForDeal(input.dealId);
    if (!existing) throw new Error("private sale deal payment was not created");
    return { kind: "existing", payment: existing };
  }

  async recordCheckout(
    id: string,
    checkout: { sessionId: string; paymentIntentId: string | null },
  ): Promise<void> {
    await this.db
      .update(privateSaleDealPayment)
      .set({
        stripeCheckoutSessionId: checkout.sessionId,
        stripePaymentIntentId: checkout.paymentIntentId,
        updatedAt: sql`now()`,
      })
      .where(eq(privateSaleDealPayment.id, id));
  }

  async markProcessing(id: string): Promise<PrivateSaleDealPayment | null> {
    return this.move(id, ["open"], { status: "processing" });
  }

  async markPaid(
    id: string,
    paid: { chargeId: string | null; paymentIntentId: string | null; at: Date },
  ): Promise<PrivateSaleDealPayment | null> {
    return this.move(id, ["open", "processing"], {
      status: "paid",
      paidAt: paid.at,
      ...(paid.chargeId ? { stripeChargeId: paid.chargeId } : {}),
      ...(paid.paymentIntentId ? { stripePaymentIntentId: paid.paymentIntentId } : {}),
    });
  }

  async markCancelled(id: string): Promise<PrivateSaleDealPayment | null> {
    return this.move(id, ["open", "processing"], { status: "cancelled" });
  }

  async markPaidByTransfer(
    id: string,
    transfer: { recordedByUserId: string; bankReference: string; at: Date },
  ): Promise<PrivateSaleDealPayment | null> {
    return this.move(id, ["open"], {
      status: "paid",
      paidAt: transfer.at,
      recordedByUserId: transfer.recordedByUserId,
      bankReference: transfer.bankReference,
    });
  }

  async markPartlyRefunded(
    id: string,
    refund: { refundedMinor: number; at: Date },
  ): Promise<PrivateSaleDealPayment | null> {
    const [row] = await this.db
      .update(privateSaleDealPayment)
      .set({ refundedMinor: refund.refundedMinor, refundedAt: refund.at, updatedAt: sql`now()` })
      .where(
        and(
          eq(privateSaleDealPayment.id, id),
          eq(privateSaleDealPayment.status, "paid"),
          sql`${privateSaleDealPayment.refundedMinor} < ${refund.refundedMinor}`,
          sql`${privateSaleDealPayment.amountMinor} > ${refund.refundedMinor}`,
        ),
      )
      .returning();
    return row ? mapPayment(row) : null;
  }

  async markRefunded(
    id: string,
    refund: { refundedMinor: number; refundId: string | null; at: Date },
  ): Promise<PrivateSaleDealPayment | null> {
    return this.move(id, ["paid"], {
      status: "refunded",
      refundedMinor: refund.refundedMinor,
      stripeRefundId: refund.refundId,
      refundedAt: refund.at,
    });
  }

  /** Applies a move only from the statuses that may make it, so a repeated event changes nothing. */
  private async move(
    id: string,
    from: PrivateSalePaymentStatus[],
    set: Partial<typeof privateSaleDealPayment.$inferInsert>,
  ): Promise<PrivateSaleDealPayment | null> {
    const [row] = await this.db
      .update(privateSaleDealPayment)
      .set({ ...set, updatedAt: sql`now()` })
      .where(and(eq(privateSaleDealPayment.id, id), inArray(privateSaleDealPayment.status, from)))
      .returning();
    return row ? mapPayment(row) : null;
  }

  private async one(
    where: ReturnType<typeof eq> | ReturnType<typeof and>,
  ): Promise<PrivateSaleDealPayment | null> {
    const [row] = await this.db.select().from(privateSaleDealPayment).where(where).limit(1);
    return row ? mapPayment(row) : null;
  }
}

/** What the invoice stage leaves on a deal, and the buyer's exposure across deals. */
export class DrizzlePrivateSaleDealFinanceStore implements IPrivateSaleDealFinanceStore {
  constructor(private readonly db: Database) {}

  async recordInvoiceReference(dealId: string, reference: string): Promise<void> {
    await this.db
      .update(privateSaleDeal)
      .set({ invoiceReference: reference, updatedAt: sql`now()` })
      .where(eq(privateSaleDeal.id, dealId));
  }

  async sumOtherOpenExposureMinor(
    buyerLegalEntityId: string,
    excludeDealId: string,
  ): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<string>`COALESCE(SUM(${privateSaleDeal.priceMinor}), 0)` })
      .from(privateSaleDeal)
      .innerJoin(
        privateSaleDealParty,
        and(
          eq(privateSaleDealParty.dealId, privateSaleDeal.id),
          eq(privateSaleDealParty.role, "buyer"),
        ),
      )
      .where(
        and(
          eq(privateSaleDealParty.legalEntityId, buyerLegalEntityId),
          ne(privateSaleDeal.id, excludeDealId),
          inArray(privateSaleDeal.stage, OPEN_EXPOSURE_STAGES),
        ),
      );
    return Number(row?.total ?? 0);
  }
}

/** Released, paid deals the payout run settles, and the deals whose payout has gone through. */
export class DrizzlePrivateSaleDealPayoutStore implements IPrivateSaleDealPayoutStore {
  constructor(private readonly db: Database) {}

  async findUnsettledReleased(sellerLegalEntityId: string): Promise<PrivateSalePayoutDeal[]> {
    const rows = await this.db
      .select({
        dealId: privateSaleDeal.id,
        reference: privateSaleDeal.reference,
        sellerLegalEntityId: privateSaleDealParty.legalEntityId,
        priceMinor: privateSaleDeal.priceMinor,
        sellerCommissionBps: privateSaleDeal.sellerCommissionBps,
        costsMinor: privateSaleDeal.costsMinor,
      })
      .from(privateSaleDeal)
      .innerJoin(
        privateSaleDealParty,
        and(
          eq(privateSaleDealParty.dealId, privateSaleDeal.id),
          eq(privateSaleDealParty.role, "seller"),
        ),
      )
      .where(
        and(eq(privateSaleDealParty.legalEntityId, sellerLegalEntityId), this.unsettledReleased()),
      )
      .orderBy(privateSaleDeal.updatedAt, privateSaleDeal.id);
    return rows.flatMap((r) =>
      r.priceMinor === null || r.sellerCommissionBps === null
        ? []
        : [
            {
              dealId: r.dealId,
              reference: r.reference,
              sellerLegalEntityId: r.sellerLegalEntityId,
              priceMinor: r.priceMinor,
              sellerCommissionBps: r.sellerCommissionBps,
              costsMinor: r.costsMinor,
            },
          ],
    );
  }

  async listSellerLegalEntityIdsWithUnsettledReleased(): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ legalEntityId: privateSaleDealParty.legalEntityId })
      .from(privateSaleDeal)
      .innerJoin(
        privateSaleDealParty,
        and(
          eq(privateSaleDealParty.dealId, privateSaleDeal.id),
          eq(privateSaleDealParty.role, "seller"),
        ),
      )
      .where(this.unsettledReleased());
    return rows.map((r) => r.legalEntityId);
  }

  async insertSaleLine(input: {
    payoutId: string;
    dealId: string;
    amount: string;
  }): Promise<PayoutLine | null> {
    const [row] = await this.db
      .insert(payoutLine)
      .values({
        payoutId: input.payoutId,
        privateSaleDealId: input.dealId,
        amount: input.amount,
        kind: "sale",
        createdByUserId: null,
        note: null,
      })
      .onConflictDoNothing()
      .returning();
    if (!row) return null;
    return {
      id: row.id,
      payoutId: row.payoutId,
      paymentId: null,
      privateSaleDealId: row.privateSaleDealId,
      amount: String(row.amount),
      kind: "sale",
      createdByUserId: null,
      note: null,
      createdAt: row.createdAt,
    };
  }

  async hasPayoutLine(dealId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: payoutLine.id })
      .from(payoutLine)
      .where(and(eq(payoutLine.privateSaleDealId, dealId), eq(payoutLine.kind, "sale")))
      .limit(1);
    return row !== undefined;
  }

  async listReleasedWithPaidPayout(limit: number): Promise<{ dealId: string; payoutId: string }[]> {
    return this.db
      .select({ dealId: privateSaleDeal.id, payoutId: payout.id })
      .from(privateSaleDeal)
      .innerJoin(
        payoutLine,
        and(eq(payoutLine.privateSaleDealId, privateSaleDeal.id), eq(payoutLine.kind, "sale")),
      )
      .innerJoin(payout, eq(payout.id, payoutLine.payoutId))
      .where(and(eq(privateSaleDeal.stage, "released"), eq(payout.status, "paid")))
      .orderBy(payout.processedAt, privateSaleDeal.id)
      .limit(limit);
  }

  /** Released, with the buyer's money in, and not yet on any payout. */
  private unsettledReleased() {
    return and(
      eq(privateSaleDeal.stage, "released"),
      sql`EXISTS (
        SELECT 1 FROM private_sale_deal_payment p
        WHERE p.deal_id = ${privateSaleDeal.id} AND p.status = 'paid'
      )`,
      sql`NOT EXISTS (
        SELECT 1 FROM payout_line pl
        WHERE pl.private_sale_deal_id = ${privateSaleDeal.id} AND pl.kind = 'sale'
      )`,
    );
  }
}
